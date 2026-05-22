import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { startService, stopRunningServices } from '../../packages/launcher/src/service-runner.ts';
import type { ServiceDefinition } from '../../packages/launcher/src/service-types.ts';

const fixtureCommand = process.execPath;
const fixtureScript = path.resolve('tests/fixtures/idle-mcp.ts');

test('startService marks a stdio service ready when the process stays alive', async () => {
  const service: ServiceDefinition = {
    id: 'fixture',
    kind: 'stdio-mcp',
    enabled: true,
    command: fixtureCommand,
    args: ['--experimental-transform-types', fixtureScript],
    cwd: process.cwd(),
    health: {
      type: 'process',
      readyDelayMs: 50
    },
    codex: {
      export: true
    }
  };

  const running = await startService(service, process.cwd());
  try {
    assert.equal(running.state, 'ready');
  } finally {
    await stopRunningServices([running]);
  }
});

test('startService marks a remote HTTP service ready without spawning a process', async () => {
  const service: ServiceDefinition = {
    id: 'vanta',
    kind: 'remote-http',
    enabled: true,
    url: 'https://mcp.vanta.com/mcp',
    codex: {
      export: true
    }
  };

  const running = await startService(service, process.cwd());

  assert.equal(running.state, 'ready');
  assert.equal(running.pid, undefined);
  assert.equal(running.child, undefined);
});

test('startService reports burp SSE failures clearly', async () => {
  const service: ServiceDefinition = {
    id: 'burp',
    kind: 'burp-proxy',
    enabled: true,
    command: fixtureCommand,
    args: ['--experimental-transform-types', fixtureScript],
    cwd: process.cwd(),
    health: {
      type: 'sse',
      url: 'http://127.0.0.1:65530/sse',
      timeoutMs: 200
    },
    codex: {
      export: true
    }
  };

  const running = await startService(service, process.cwd());

  assert.equal(running.state, 'failed');
  assert.match(running.message ?? '', /Burp SSE endpoint is unreachable/i);
  assert.match(running.message ?? '', /confirm burp-mcp-all\.jar is loaded/i);
  assert.match(running.message ?? '', /disable the burp service/i);
});

test('startService accepts a reachable burp SSE endpoint', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response('', {
      status: 200,
      headers: {
        'content-type': 'text/event-stream'
      }
    });

  const service: ServiceDefinition = {
    id: 'burp',
    kind: 'burp-proxy',
    enabled: true,
    command: fixtureCommand,
    args: ['--experimental-transform-types', fixtureScript],
    cwd: process.cwd(),
    health: {
      type: 'sse',
      url: 'http://127.0.0.1:9876/sse',
      timeoutMs: 500
    },
    codex: {
      export: true
    }
  };

  const running = await startService(service, process.cwd());
  try {
    assert.equal(running.state, 'ready');
  } finally {
    globalThis.fetch = originalFetch;
    await stopRunningServices([running]);
  }
});
