import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

export {
  generateFindingsReport,
  runScopedActiveChecks,
  runStjarnskottWorkflow,
  summarizeBurpHistory
} from './stjarnskott-workflow.mjs';

const execFileAsync = promisify(execFile);
const DEFAULT_SSE_URL = 'http://127.0.0.1:9876';

export async function findWorkspaceRoot({ startDir = process.cwd(), searchHome = true } = {}) {
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

export async function checkBurpHealth({
  sseUrl = DEFAULT_SSE_URL,
  fetchImpl = globalThis.fetch,
  listProcesses = defaultListProcesses
} = {}) {
  const processList = await listProcesses().catch(() => '');
  const burpRunning = processList.toLowerCase().includes('burp suite');

  let listenerReachable = false;
  let listenerDetail = '';
  for (const candidateUrl of buildSseCandidateUrls(sseUrl)) {
    try {
      const response = await fetchImpl(candidateUrl, {
        method: 'GET',
        headers: {
          accept: 'text/event-stream'
        },
        signal: AbortSignal.timeout(2_000)
      });
      listenerReachable = response.ok;
      listenerDetail = response.ok ? `HTTP ${response.status} at ${candidateUrl}` : `HTTP ${response.status} at ${candidateUrl}`;
      if (listenerReachable) {
        break;
      }
    } catch (error) {
      listenerDetail = `${formatError(error)} at ${candidateUrl}`;
    }
  }

  return {
    burpRunning,
    listenerReachable,
    sseUrl,
    message: buildBurpHealthMessage({ burpRunning, listenerReachable, sseUrl, listenerDetail })
  };
}

function buildSseCandidateUrls(url) {
  const parsed = new URL(url);
  const candidates = [parsed.toString()];

  if (parsed.pathname.endsWith('/sse')) {
    const withoutSse = new URL(parsed.toString());
    withoutSse.pathname = withoutSse.pathname.replace(/\/sse$/, '') || '/';
    candidates.push(withoutSse.toString());
  } else {
    const withSse = new URL(parsed.toString());
    withSse.pathname = `${withSse.pathname.replace(/\/$/, '')}/sse`;
    candidates.push(withSse.toString());
  }

  return [...new Set(candidates)];
}

export async function prepareCodexForBurp({
  workspaceRoot,
  install = false,
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

  const exportResult = await runCommand({
    command: 'npm',
    args: ['run', 'export:codex'],
    cwd: detectedRoot
  });

  const commands = [
    {
      command: 'npm',
      args: ['run', 'export:codex'],
      exitCode: exportResult.exitCode
    }
  ];

  if (exportResult.exitCode !== 0) {
    return {
      ok: false,
      workspaceRoot: detectedRoot,
      commands,
      statusPath: path.join(detectedRoot, 'generated/codex/status.json'),
      logPath: path.join(detectedRoot, 'generated/codex/logs/burp.stderr.log'),
      message: 'Export failed. Check generated/codex/status.json and generated/codex/logs/burp.stderr.log for the guided Burp status.'
    };
  }

  if (install) {
    const installResult = await runCommand({
      command: 'node',
      args: ['--experimental-transform-types', 'platforms/codex/src/cli.ts', 'install'],
      cwd: detectedRoot
    });
    commands.push({
      command: 'node',
      args: ['--experimental-transform-types', 'platforms/codex/src/cli.ts', 'install'],
      exitCode: installResult.exitCode
    });

    if (installResult.exitCode !== 0) {
      return {
        ok: false,
        workspaceRoot: detectedRoot,
        commands,
        message: 'Export succeeded but install failed. Check ~/.codex/config.toml permissions and rerun install.'
      };
    }
  }

  return {
    ok: true,
    workspaceRoot: detectedRoot,
    commands,
    statusPath: path.join(detectedRoot, 'generated/codex/status.json'),
    logPath: path.join(detectedRoot, 'generated/codex/logs/burp.stderr.log'),
    message: install
      ? 'Burp export and Codex install completed. Restart the Codex app or open a new CLI session to reload MCP servers.'
      : 'Burp export completed. Run install next if you want the managed MCP block merged into ~/.codex/config.toml.'
  };
}

export async function passiveWebCheck({ url, fetchImpl = globalThis.fetch } = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('url is required');
  }

  const normalized = new URL(url).toString();
  const [head, robots, security] = await Promise.all([
    fetchText(fetchImpl, normalized, { method: 'HEAD' }),
    fetchText(fetchImpl, new URL('/robots.txt', normalized).toString()),
    fetchText(fetchImpl, new URL('/.well-known/security.txt', normalized).toString())
  ]);

  return {
    url: normalized,
    head,
    robots,
    security,
    message: buildPassiveWebCheckMessage(normalized, head, robots, security)
  };
}

export function buildBurpHealthMessage({ burpRunning, listenerReachable, sseUrl, listenerDetail }) {
  if (listenerReachable) {
    return `Burp is reachable at ${sseUrl}. The Burp app appears ${burpRunning ? 'to be running' : 'not to be running'}, but the listener responded successfully (${listenerDetail}).`;
  }

  const intro = burpRunning
    ? `Burp appears to be running, but the MCP listener is not reachable at ${sseUrl}.`
    : `Burp does not appear to be running and the MCP listener is not reachable at ${sseUrl}.`;

  return [
    intro,
    'If you want Burp enabled for this run:',
    '1. Make sure Burp Suite is open.',
    '2. In Burp, open Extensions and confirm burp-mcp-all.jar is loaded.',
    '3. Open the MCP tab and enable the listener.',
    `4. Leave the listener on ${sseUrl} or update platforms/codex/services.json to match Burp.`,
    '5. Rerun the launcher or the prepare tool.',
    'If you do not want Burp for this run, disable the burp service in platforms/codex/services.json or use passive shell checks only.',
    `Probe detail: ${listenerDetail}`
  ].join(' ');
}

function buildPassiveWebCheckMessage(url, head, robots, security) {
  return [
    `Passive web check for ${url}`,
    `HEAD result: ${head.ok ? 'ok' : 'failed'} (${head.status ?? head.error})`,
    `robots.txt: ${robots.ok ? 'present' : 'not available'} (${robots.status ?? robots.error})`,
    `security.txt: ${security.ok ? 'present' : 'not available'} (${security.status ?? security.error})`
  ].join('\n');
}

async function findMarkerRoot(startDir) {
  let current = startDir;
  while (true) {
    const marker = path.join(current, 'platforms/codex/services.json');
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

async function fetchText(fetchImpl, url, init) {
  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(5_000)
    });
    const text = init?.method === 'HEAD' ? '' : await response.text();
    return {
      ok: response.ok,
      status: response.status,
      headers: Object.fromEntries([...response.headers.entries()].map(([key, value]) => [key.toLowerCase(), value])),
      text
    };
  } catch (error) {
    return {
      ok: false,
      error: formatError(error),
      headers: {},
      text: ''
    };
  }
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
