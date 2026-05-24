import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_ZAP_HTTP_URL = 'http://127.0.0.1:8282';
const CLI_SCRIPT = fileURLToPath(new URL('../../codex/src/cli.ts', import.meta.url));
const DEFAULT_ZAP_MANIFEST = 'codex/services.zap.json';
const DEFAULT_ZAP_LOCAL_MANIFEST = 'codex/services.zap.local.json';

export async function checkZapHealth({
  url = DEFAULT_ZAP_HTTP_URL,
  headers = {},
  fetchImpl = globalThis.fetch,
  listProcesses = defaultListProcesses
} = {}) {
  const processList = await listProcesses().catch(() => '');
  const zapRunning = processList.toLowerCase().includes('zap');

  let listenerReachable = false;
  let listenerDetail = '';

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...headers
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: {
            name: 'stjarnskott',
            version: '0.1.0'
          }
        }
      }),
      signal: AbortSignal.timeout(2_000)
    });

    listenerReachable = response.ok || response.status === 401 || response.status === 403;
    listenerDetail = `HTTP ${response.status} at ${url}`;
  } catch (error) {
    listenerDetail = `${formatError(error)} at ${url}`;
  }

  return {
    zapRunning,
    listenerReachable,
    url,
    headersConfigured: Object.keys(headers).length > 0,
    message: buildZapHealthMessage({ zapRunning, listenerReachable, url, listenerDetail, headersConfigured: Object.keys(headers).length > 0 })
  };
}

export async function prepareCodexForZap({
  workspaceRoot,
  install = false,
  manifestPath = DEFAULT_ZAP_MANIFEST,
  url = DEFAULT_ZAP_HTTP_URL,
  securityKey,
  runCommand = defaultRunCommand
} = {}) {
  const detectedRoot = workspaceRoot ?? await findWorkspaceRoot();
  if (!detectedRoot) {
    return {
      ok: false,
      workspaceRoot: null,
      message: 'Could not find a Stjarnskott workspace. Open Codex in the repository root or pass workspace_root explicitly.'
    };
  }

  const headers = securityKey
    ? {
        Authorization: securityKey.startsWith('Bearer ') ? securityKey : `Bearer ${securityKey}`
      }
    : undefined;

  const exportManifestPath = localManifestPathFor(manifestPath);
  await writeLocalZapManifest({
    workspaceRoot: detectedRoot,
    sourceManifestPath: manifestPath,
    outputManifestPath: exportManifestPath,
    url,
    headers
  });

  const exportResult = await runCommand({
    command: 'node',
    args: ['--experimental-transform-types', CLI_SCRIPT, 'export', '--manifest', exportManifestPath],
    cwd: detectedRoot
  });

  const commands = [
    {
      command: 'node',
      args: ['--experimental-transform-types', CLI_SCRIPT, 'export', '--manifest', exportManifestPath],
      exitCode: exportResult.exitCode
    }
  ];

  if (exportResult.exitCode !== 0) {
    return {
      ok: false,
      workspaceRoot: detectedRoot,
      commands,
      statusPath: path.join(detectedRoot, 'generated/codex/status.json'),
      logPath: path.join(detectedRoot, 'generated/codex/logs/zap.stderr.log'),
      message: 'ZAP export failed. Check generated/codex/status.json for service status and rerun the prepare command.'
    };
  }

  if (install) {
    const installResult = await runCommand({
      command: 'node',
      args: ['--experimental-transform-types', CLI_SCRIPT, 'install'],
      cwd: detectedRoot
    });
    commands.push({
      command: 'node',
      args: ['--experimental-transform-types', CLI_SCRIPT, 'install'],
      exitCode: installResult.exitCode
    });

    if (installResult.exitCode !== 0) {
      return {
        ok: false,
        workspaceRoot: detectedRoot,
        commands,
        message: 'ZAP export succeeded but install failed. Check ~/.codex/config.toml permissions and rerun install.'
      };
    }
  }

  return {
    ok: true,
    workspaceRoot: detectedRoot,
    commands,
    statusPath: path.join(detectedRoot, 'generated/codex/status.json'),
    logPath: path.join(detectedRoot, 'generated/codex/logs/zap.stderr.log'),
    message: install
      ? 'ZAP manifest updated, export completed, and the managed MCP block was installed into Codex config.'
      : 'ZAP manifest updated and export completed. Run install next if you want the managed MCP block merged into ~/.codex/config.toml.'
  };
}

async function writeLocalZapManifest({ workspaceRoot, sourceManifestPath, outputManifestPath, url, headers }) {
  const sourceFile = path.join(workspaceRoot, sourceManifestPath);
  const outputFile = path.join(workspaceRoot, outputManifestPath);
  const manifest = JSON.parse(await readFile(sourceFile, 'utf8'));
  if (!Array.isArray(manifest.services)) {
    throw new Error(`Manifest at ${sourceFile} must contain a services array.`);
  }

  let updated = false;
  manifest.services = manifest.services.map((service) => {
    if (service?.id !== 'zap') {
      return service;
    }

    updated = true;
    return {
      ...service,
      url,
      ...(headers ? { headers } : {}),
      ...(headers ? {} : { headers: undefined })
    };
  });

  if (!updated) {
    throw new Error(`Could not find a zap service entry in ${sourceFile}.`);
  }

  await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function localManifestPathFor(manifestPath) {
  if (manifestPath === DEFAULT_ZAP_MANIFEST) {
    return DEFAULT_ZAP_LOCAL_MANIFEST;
  }

  return manifestPath.replace(/\.json$/i, '.local.json');
}

async function findWorkspaceRoot({ startDir = process.cwd(), searchHome = true } = {}) {
  const explicit = process.env.STJARNSKOTT_WORKSPACE_ROOT;
  if (explicit) {
    const found = await findMarkerRoot(path.resolve(explicit));
    if (found) {
      return found;
    }
  }

  const local = await findMarkerRoot(path.resolve(startDir));
  if (local) {
    return local;
  }

  const pwd = process.env.PWD;
  if (pwd) {
    const fromPwd = await findMarkerRoot(path.resolve(pwd));
    if (fromPwd) {
      return fromPwd;
    }
  }

  if (!searchHome) {
    return null;
  }

  for (const candidate of homeSearchCandidates()) {
    const found = await findMarkerRoot(candidate);
    if (found) {
      return found;
    }
  }

  return null;
}

async function findMarkerRoot(startDir) {
  let current = startDir;
  while (true) {
    const marker = path.join(current, 'codex/services.json');
    try {
      await readFile(marker, 'utf8');
      return current;
    } catch {}

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function homeSearchCandidates() {
  const home = os.homedir();
  return [
    path.join(home, 'Work'),
    path.join(home, 'code'),
    path.join(home, 'Code'),
    path.join(home, 'dev'),
    path.join(home, 'Developer')
  ];
}

function buildZapHealthMessage({ zapRunning, listenerReachable, url, listenerDetail, headersConfigured }) {
  if (listenerReachable) {
    return `ZAP MCP appears reachable at ${url}. The ZAP app appears ${zapRunning ? 'to be running' : 'not to be running'}, and the endpoint responded (${listenerDetail}).${headersConfigured ? ' Authorization headers are configured.' : ''}`;
  }

  const intro = zapRunning
    ? `ZAP appears to be running, but the MCP endpoint is not reachable at ${url}.`
    : `ZAP does not appear to be running and the MCP endpoint is not reachable at ${url}.`;

  return [
    intro,
    'If you want ZAP enabled for this run:',
    '1. Make sure OWASP ZAP is open.',
    '2. In ZAP, install the MCP Integration add-on from the Marketplace.',
    '3. In ZAP, open Options -> MCP Integration and enable the server.',
    `4. Leave the listener on ${url} or rerun prepare-zap with a different URL.`,
    headersConfigured
      ? '5. Confirm the configured Authorization header matches the current ZAP security key.'
      : '5. If the ZAP security key is enabled, rerun prepare-zap with --security-key.',
    'If HTTPS is enabled in ZAP, make sure your client trusts the ZAP root CA or switch to local HTTP.',
    `Probe detail: ${listenerDetail}`
  ].join(' ');
}

async function defaultListProcesses() {
  const { stdout } = await execFileAsync('ps', ['aux']);
  return stdout;
}

async function defaultRunCommand({ command, args, cwd }) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { cwd });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return {
      exitCode: typeof error?.code === 'number' ? error.code : 1,
      stdout: error?.stdout ?? '',
      stderr: error?.stderr ?? formatError(error)
    };
  }
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
