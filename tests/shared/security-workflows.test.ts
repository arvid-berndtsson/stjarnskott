import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  checkBurpHealth,
  findWorkspaceRoot,
  prepareCodexForBurp,
  runScopedActiveChecks,
  runStjarnskottWorkflow,
  summarizeBurpHistory
} from '../../packages/security-workflows/src/index.mjs';

test('findWorkspaceRoot discovers the repo root from a nested path', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'stjarnskott-plugin-'));
  const nested = path.join(root, 'a', 'b', 'c');
  await mkdir(nested, { recursive: true });
  await mkdir(path.join(root, 'codex'), { recursive: true });
  await writeFile(path.join(root, 'codex/services.json'), '{"services":[]}\n', 'utf8');

  const detected = await findWorkspaceRoot({ startDir: nested });

  assert.equal(detected, root);
});

test('checkBurpHealth returns guided setup steps when the listener is down', async () => {
  const result = await checkBurpHealth({
    sseUrl: 'http://127.0.0.1:9876',
    fetchImpl: async () => {
      throw new Error('fetch failed');
    },
    listProcesses: async () => 'Burp Suite Community Edition'
  });

  assert.equal(result.listenerReachable, false);
  assert.equal(result.burpRunning, true);
  assert.match(result.message, /enable the listener/i);
  assert.match(result.message, /do not want Burp for this run/i);
});

test('prepareCodexForBurp runs export and install when asked', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'stjarnskott-plugin-'));
  await mkdir(path.join(root, 'codex'), { recursive: true });
  await writeFile(path.join(root, 'codex/services.json'), '{"services":[]}\n', 'utf8');

  const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
  const result = await prepareCodexForBurp({
    workspaceRoot: root,
    install: true,
    runCommand: async ({ command, args, cwd }) => {
      calls.push({ command, args, cwd });
      return {
        exitCode: 0,
        stdout: 'ok',
        stderr: ''
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    command: 'npm',
    args: ['run', 'export:codex'],
    cwd: root
  });
  assert.deepEqual(calls[1], {
    command: 'node',
    args: ['--experimental-transform-types', 'codex/src/cli.ts', 'install'],
    cwd: root
  });
});

test('summarizeBurpHistory normalizes endpoints from Burp history', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'stjarnskott-plugin-'));
  const fakeServer = path.resolve('tests/fixtures/fake-burp-mcp-server.mjs');

  const summary = await summarizeBurpHistory({
    workspaceRoot: root,
    commandRunner: async ({ toolName, args }) => {
      const { createBurpMcpClient } = await import('../../packages/security-workflows/src/index.mjs');
      const client = await createBurpMcpClient({
        command: process.execPath,
        args: [fakeServer]
      });

      try {
        return await client.callTool(toolName, args);
      } finally {
        await client.close();
      }
    }
  });

  assert.equal(summary.historyCount, 3);
  assert.equal(summary.endpointCount, 3);
  assert.equal(summary.targetUrl, 'https://example.com/');
  assert.match(summary.message, /normalized 3 unique endpoints/i);
});

test('runStjarnskottWorkflow writes findings artifacts in limited mode fallback', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'stjarnskott-plugin-'));
  await mkdir(path.join(root, 'codex'), { recursive: true });
  await writeFile(path.join(root, 'codex/services.json'), '{"services":[]}\n', 'utf8');

  const fetchImpl = async (url, init = {}) => {
    const target = new URL(url);
    const body = target.pathname === '/robots.txt'
      ? 'User-agent: *\nDisallow: /admin\n'
      : target.pathname === '/.well-known/security.txt'
        ? 'Contact: mailto:security@example.com\n'
        : '';

    return new Response(body, {
      status: 200,
      headers: {
        server: 'test-server',
        ...(init.method === 'HEAD' ? {} : { 'content-type': 'text/plain' })
      }
    });
  };

  const result = await runStjarnskottWorkflow({
    workspaceRoot: root,
    targetUrl: 'https://example.com',
    mode: 'active',
    fetchImpl,
    commandRunner: async () => {
      throw new Error('Burp unavailable');
    }
  });

  assert.equal(result.limitedMode, true);
  assert.ok(result.artifacts?.findingsPath);
  const findingsFile = JSON.parse(await readFile(result.artifacts.findingsPath, 'utf8'));
  const reportFile = await readFile(result.artifacts.reportPath, 'utf8');
  assert.equal(findingsFile.targetUrl, 'https://example.com/');
  assert.match(reportFile, /Stjarnskott Findings Report/);
  assert.match(result.message, /limited mode/i);
});

test('runScopedActiveChecks flags sensitive active responses', async () => {
  const fetchImpl = async (url) => {
    const target = new URL(url);
    const status = target.pathname === '/.git/HEAD' ? 200 : 404;
    return new Response(status === 200 ? 'ref: refs/heads/main' : '', {
      status,
      headers: {
        'content-type': 'text/plain'
      }
    });
  };

  const result = await runScopedActiveChecks({
    targetUrl: 'https://example.com',
    fetchImpl
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].severity, 'high');
  assert.match(result.findings[0].title, /Git metadata endpoint/i);
});
