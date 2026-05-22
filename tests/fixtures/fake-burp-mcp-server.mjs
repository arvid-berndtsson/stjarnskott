#!/usr/bin/env node

let buffer = Buffer.alloc(0);

const historyItems = [
  JSON.stringify({
    request: 'GET / HTTP/1.1\r\nHost: example.com\r\nUser-Agent: test\r\n\r\n',
    response: 'HTTP/1.1 200 OK\r\nServer: Example\r\n\r\n',
    notes: 'home'
  }),
  JSON.stringify({
    request: 'GET /admin HTTP/1.1\r\nHost: example.com\r\n\r\n',
    response: 'HTTP/1.1 302 Found\r\nLocation: /login\r\n\r\n',
    notes: 'admin'
  }),
  JSON.stringify({
    request: 'POST /graphql HTTP/1.1\r\nHost: example.com\r\n\r\n',
    response: 'HTTP/1.1 200 OK\r\n\r\n',
    notes: 'graphql'
  })
];

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  processBuffer();
});

function processBuffer() {
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      return;
    }

    const headers = buffer.slice(0, headerEnd).toString('utf8');
    const match = headers.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      throw new Error('Missing Content-Length');
    }

    const contentLength = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + contentLength;
    if (buffer.length < bodyEnd) {
      return;
    }

    const message = JSON.parse(buffer.slice(bodyStart, bodyEnd).toString('utf8'));
    buffer = buffer.slice(bodyEnd);
    handleMessage(message);
  }
}

function handleMessage(message) {
  if (message.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'fake-burp',
          version: '0.0.1'
        }
      }
    });
    return;
  }

  if (message.method === 'notifications/initialized') {
    return;
  }

  if (message.method === 'tools/call') {
    const { name, arguments: args = {} } = message.params ?? {};
    if (name !== 'get_proxy_http_history') {
      send({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [{ type: 'text', text: 'Unsupported tool' }]
        }
      });
      return;
    }

    const offset = Number(args.offset ?? 0);
    const count = Number(args.count ?? 25);
    const selection = historyItems.slice(offset, offset + count);
    const text = selection.length === 0 ? 'Reached end of items' : selection.join('\n\n');
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        content: [{ type: 'text', text }]
      }
    });
  }
}

function send(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}
