import { spawn } from 'node:child_process';

export async function withBurpMcpClient(options, callback) {
  const client = await createBurpMcpClient(options);
  try {
    return await callback(client);
  } finally {
    await client.close();
  }
}

export async function createBurpMcpClient({
  command,
  args = [],
  cwd,
  env,
  spawnImpl = spawn,
  requestTimeoutMs = 20_000
} = {}) {
  if (!command) {
    throw new Error('A Burp MCP proxy command is required.');
  }

  const child = spawnImpl(command, args, {
    cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stderr = '';
  let stdoutBuffer = Buffer.alloc(0);
  let nextId = 1;
  let closed = false;
  const pending = new Map();

  const rejectPending = (error) => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timeoutId);
      entry.reject(error);
    }
    pending.clear();
  };

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  child.stdout.on('data', (chunk) => {
    stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
    processBuffer();
  });

  child.on('error', (error) => {
    rejectPending(new Error(`Burp MCP proxy failed to start: ${error.message}`));
  });

  child.on('exit', (code, signal) => {
    closed = true;
    const detail = stderr.trim() || `exit code ${code ?? 'unknown'}${signal ? `, signal ${signal}` : ''}`;
    rejectPending(new Error(`Burp MCP proxy exited before completing the request: ${detail}`));
  });

  function processBuffer() {
    while (true) {
      const headerEnd = stdoutBuffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        return;
      }

      const headerText = stdoutBuffer.slice(0, headerEnd).toString('utf8');
      const lengthMatch = headerText.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) {
        throw new Error('Burp MCP proxy returned a message without Content-Length.');
      }

      const contentLength = Number(lengthMatch[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;
      if (stdoutBuffer.length < bodyEnd) {
        return;
      }

      const rawMessage = stdoutBuffer.slice(bodyStart, bodyEnd).toString('utf8');
      stdoutBuffer = stdoutBuffer.slice(bodyEnd);
      const message = JSON.parse(rawMessage);

      if (message.id !== undefined && pending.has(message.id)) {
        const entry = pending.get(message.id);
        pending.delete(message.id);
        clearTimeout(entry.timeoutId);
        if (message.error) {
          entry.reject(new Error(message.error.message ?? 'Unknown MCP error.'));
        } else {
          entry.resolve(message.result);
        }
      }
    }
  }

  async function sendRequest(method, params = {}) {
    if (closed) {
      throw new Error(`Burp MCP proxy is already closed. ${stderr.trim()}`.trim());
    }

    const id = nextId;
    nextId += 1;

    const body = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params
    });

    const timeoutId = setTimeout(() => {
      const entry = pending.get(id);
      if (entry) {
        pending.delete(id);
        entry.reject(new Error(`Timed out waiting for MCP response to ${method}.`));
      }
    }, requestTimeoutMs);

    const responsePromise = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, timeoutId });
    });

    child.stdin.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
    return responsePromise;
  }

  await sendRequest('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {
      tools: {}
    },
    clientInfo: {
      name: 'stjarnskott',
      version: '0.1.0'
    }
  });

  child.stdin.write(
    `Content-Length: ${Buffer.byteLength(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }), 'utf8')}\r\n\r\n${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}`
  );

  return {
    async callTool(name, args = {}) {
      const result = await sendRequest('tools/call', {
        name,
        arguments: args
      });
      return result;
    },
    getStderr() {
      return stderr;
    },
    async close() {
      if (closed) {
        return;
      }

      closed = true;
      rejectPending(new Error('Burp MCP proxy connection closed.'));
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
          resolve();
        }, 1_000);

        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  };
}
