import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';

test('plugin MCP server lists the expected Stjarnskott tools', async () => {
  const scriptPath = path.resolve('codex/marketplace/plugins/burp/scripts/stjarnskott-burp-mcp.mjs');
  const child = spawn(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      STJARNSKOTT_WORKSPACE_ROOT: path.resolve('.')
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let buffer = Buffer.alloc(0);
  const pending = new Map();
  let nextId = 1;

  child.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    processBuffer();
  });

  function processBuffer() {
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        return;
      }

      const headerText = buffer.slice(0, headerEnd).toString('utf8');
      const match = headerText.match(/Content-Length:\s*(\d+)/i);
      assert.ok(match, 'Missing Content-Length header from plugin MCP server');

      const contentLength = Number(match[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;
      if (buffer.length < bodyEnd) {
        return;
      }

      const message = JSON.parse(buffer.slice(bodyStart, bodyEnd).toString('utf8'));
      buffer = buffer.slice(bodyEnd);

      if (message.id !== undefined && pending.has(message.id)) {
        const resolve = pending.get(message.id);
        pending.delete(message.id);
        resolve(message.result);
      }
    }
  }

  function sendRequest(method: string, params: Record<string, unknown> = {}) {
    const id = nextId;
    nextId += 1;

    const body = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params
    });

    child.stdin.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
    return new Promise((resolve) => {
      pending.set(id, resolve);
    });
  }

  try {
    await sendRequest('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: {
        name: 'test',
        version: '0.0.1'
      }
    });

    child.stdin.write(
      `Content-Length: ${Buffer.byteLength(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }), 'utf8')}\r\n\r\n${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}`
    );

    const result = await sendRequest('tools/list') as { tools: Array<{ name: string }> };
    const toolNames = result.tools.map((tool) => tool.name);

    assert.deepEqual(toolNames, [
      'stjarnskott:burp-health-check',
      'stjarnskott:burp-find-workspace',
      'stjarnskott:burp-prepare-codex',
      'stjarnskott:burp-passive-web-check',
      'stjarnskott:burp-summarize-history',
      'stjarnskott:burp-discover-surface',
      'stjarnskott:burp-run-active-checks',
      'stjarnskott:burp-generate-report',
      'stjarnskott:burp-workflow'
    ]);
  } finally {
    child.kill('SIGTERM');
  }
});
