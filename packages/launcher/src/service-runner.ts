import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';

import type { RunningService, ServiceDefinition } from './service-types.ts';

export async function startService(service: ServiceDefinition, workspaceRoot: string): Promise<RunningService> {
  if (service.kind === 'remote-http') {
    return {
      service,
      state: 'ready',
      logs: {
        stderr: ''
      }
    };
  }

  const command = resolvePath(service.command, workspaceRoot);
  const args = service.args ?? [];
  const cwd = resolveWorkingDirectory(service.cwd, workspaceRoot);
  const env = {
    ...process.env,
    ...service.env
  };

  let child;
  try {
    child = spawn(command, args, {
      cwd,
      env,
      stdio: 'pipe'
    });
  } catch (error) {
    return {
      service,
      state: 'failed',
      message: `Proxy process failed to start: ${formatError(error)}.`,
      logs: {
        stderr: ''
      }
    };
  }

  const stderr: string[] = [];
  child.stderr.on('data', (chunk) => {
    stderr.push(String(chunk));
  });

  const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });

  const spawnErrorPromise = new Promise<Error>((resolve) => {
    child.once('error', (error) => resolve(error));
  });

  if (service.health?.type === 'sse') {
    const reachable = await waitForSseReachable(
      service.health.url,
      service.health.timeoutMs ?? 5_000,
      service.health.intervalMs ?? 250,
      exitPromise,
      spawnErrorPromise
    );
    if (reachable !== true) {
      await terminateChild(child);
      return {
        service,
        state: 'failed',
        message: classifyBurpFailure(service.health.url, reachable, stderr.join('')),
        logs: {
          stderr: stderr.join('')
        }
      };
    }

    return {
      service,
      state: 'ready',
      pid: child.pid,
      child,
      logs: {
        stderr: stderr.join('')
      }
    };
  }

  const readyDelayMs = service.health?.type === 'process' ? service.health.readyDelayMs ?? 300 : 300;
  const processReady = await Promise.race([
    delay(readyDelayMs).then(() => true),
    exitPromise.then(({ code, signal }) => `Process exited before becoming ready (code=${code}, signal=${signal}).`),
    spawnErrorPromise.then((error) => `Process failed to start: ${formatError(error)}.`)
  ]);

  if (processReady !== true) {
    await terminateChild(child);
    return {
      service,
      state: 'failed',
      message: processReady,
      logs: {
        stderr: stderr.join('')
      }
    };
  }

  return {
    service,
    state: 'ready',
    pid: child.pid,
    child,
    logs: {
      stderr: stderr.join('')
    }
  };
}

export async function stopRunningServices(statuses: RunningService[]): Promise<void> {
  await Promise.all(
    statuses.map(async (status) => {
      if (!status.child) {
        return;
      }

      await terminateChild(status.child);
    })
  );
}

async function waitForSseReachable(
  url: string,
  timeoutMs: number,
  intervalMs: number,
  exitPromise: Promise<{ code: number | null; signal: NodeJS.Signals | null }>,
  spawnErrorPromise: Promise<Error>
): Promise<true | string> {
  const deadline = Date.now() + timeoutMs;
  const candidateUrls = buildSseCandidateUrls(url);

  while (Date.now() < deadline) {
    const exited = await Promise.race([
      exitPromise.then(({ code, signal }) => `Proxy process exited before Burp became ready (code=${code}, signal=${signal}).`),
      spawnErrorPromise.then((error) => `Proxy process failed to start: ${formatError(error)}.`),
      probeSseCandidates(candidateUrls).then((result) => (result === true ? true : undefined))
    ]);

    if (exited === true || typeof exited === 'string') {
      return exited;
    }

    await delay(intervalMs);
  }

  return `Timed out waiting for SSE endpoint ${url}.`;
}

async function probeSseCandidates(urls: string[]): Promise<true | string> {
  let lastFailure = `Timed out waiting for SSE endpoint ${urls[0]}.`;

  for (const url of urls) {
    const result = await probeSse(url);
    if (result === true) {
      return true;
    }
    lastFailure = result;
  }

  return lastFailure;
}

async function probeSse(url: string): Promise<true | string> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(1_000),
      headers: {
        accept: 'text/event-stream'
      }
    });

    if (response.ok) {
      return true;
    }

    return `Burp responded with HTTP ${response.status} at ${url}.`;
  } catch (error) {
    return formatError(error);
  }
}

function buildSseCandidateUrls(url: string): string[] {
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

function classifyBurpFailure(url: string, reason: string, stderr: string): string {
  if (
    (reason.startsWith('Proxy process failed to start') || reason.startsWith('Proxy process exited before')) &&
    (stderr.includes('Connection refused') || stderr.includes('Failed to connect to SSE server'))
  ) {
    return [
      `Burp SSE endpoint is unreachable at ${url}.`,
      'If you want Burp enabled for this run:',
      '1. Make sure Burp Suite is open.',
      '2. In Burp, open Extensions and confirm burp-mcp-all.jar is loaded.',
      '3. Open the MCP tab and enable the listener.',
      `4. Leave the listener on ${url} or update codex-workbench.services.json to match Burp.`,
      '5. Rerun the launcher.',
      'If you do not want Burp for this run, disable the burp service in codex-workbench.services.json or run a subset of services.',
      `Proxy detail: ${reason}`
    ].join(' ');
  }

  if (reason.includes('HTTP 404') || reason.includes('HTTP 405')) {
    return [
      `Burp responded but the MCP SSE endpoint was not available at ${url}.`,
      'If you want Burp enabled for this run:',
      '1. In Burp, open Extensions and confirm burp-mcp-all.jar is loaded.',
      '2. Open the MCP tab from the extension and enable the server.',
      `3. Confirm the listener URL matches ${url}.`,
      '4. Rerun the launcher.',
      'If you do not want Burp for this run, disable the burp service in codex-workbench.services.json.',
      `Probe detail: ${reason}`
    ].join(' ');
  }

  if (reason.includes('ECONNREFUSED') || reason.includes('fetch failed') || reason.includes('Timed out waiting for SSE endpoint')) {
    return [
      `Burp SSE endpoint is unreachable at ${url}.`,
      'If you want Burp enabled for this run:',
      '1. Make sure Burp Suite is open.',
      '2. In Burp, open Extensions and confirm burp-mcp-all.jar is loaded.',
      '3. Open the MCP tab and enable the listener.',
      `4. Leave the listener on ${url} or update codex-workbench.services.json to match Burp.`,
      '5. Rerun the launcher.',
      'If you do not want Burp for this run, disable the burp service in codex-workbench.services.json or run a subset of services.',
      `Probe detail: ${reason}`
    ].join(' ');
  }

  if (reason.startsWith('Proxy process failed to start') || reason.startsWith('Proxy process exited before')) {
    const detail = stderr.trim().length > 0 ? ` ${stderr.trim()}` : '';
    return `${reason}${detail}`;
  }

  return `Failed to validate the Burp SSE endpoint. ${reason}`;
}

async function terminateChild(child: RunningService['child']): Promise<void> {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }

  child.kill('SIGTERM');
  const exited = await Promise.race([
    new Promise<boolean>((resolve) => {
      child.once('exit', () => resolve(true));
    }),
    delay(1_000).then(() => false)
  ]);

  if (!exited && child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

function resolvePath(value: string, workspaceRoot: string): string {
  if (value.startsWith('./') || value.startsWith('../')) {
    return path.resolve(workspaceRoot, value);
  }

  return value;
}

function resolveWorkingDirectory(value: string | undefined, workspaceRoot: string): string {
  if (!value) {
    return workspaceRoot;
  }

  if (value.startsWith('./') || value.startsWith('../')) {
    return path.resolve(workspaceRoot, value);
  }

  return value;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
