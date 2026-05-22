import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadManifest } from '../../packages/launcher/src/manifest.ts';

test('loadManifest loads a valid manifest with stdio and burp services', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'stjarnskott-manifest-'));
  const file = path.join(dir, 'manifest.json');

  await writeFile(
    file,
    JSON.stringify({
      services: [
        {
          id: 'burp',
          kind: 'burp-proxy',
          enabled: true,
          command: './integrations/burp/run-burp-mcp-proxy.sh',
          args: [],
          cwd: '.',
          env: {
            BURP_MCP_SSE_URL: 'http://127.0.0.1:9876'
          },
          health: {
            type: 'sse',
            url: 'http://127.0.0.1:9876'
          },
          codex: {
            export: true
          }
        },
        {
          id: 'fixture',
          kind: 'stdio-mcp',
          enabled: true,
          command: 'node',
          args: ['tests/fixtures/idle-mcp.ts'],
          health: {
            type: 'process'
          },
          codex: {
            export: true
          }
        },
        {
          id: 'vanta',
          kind: 'remote-http',
          enabled: true,
          url: 'https://mcp.vanta.com/mcp',
          codex: {
            export: true
          }
        }
      ]
    }),
    'utf8'
  );

  const manifest = await loadManifest(file);

  assert.equal(manifest.services.length, 3);
  assert.equal(manifest.services[0].kind, 'burp-proxy');
  assert.equal(manifest.services[1].kind, 'stdio-mcp');
  assert.equal(manifest.services[2].kind, 'remote-http');
});

test('loadManifest rejects unknown service kinds', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'stjarnskott-manifest-'));
  const file = path.join(dir, 'manifest.json');

  await writeFile(
    file,
    JSON.stringify({
      services: [
        {
          id: 'bad',
          kind: 'nope',
          enabled: true,
          command: 'echo',
          args: []
        }
      ]
    }),
    'utf8'
  );

  await assert.rejects(
    () => loadManifest(file),
    /unknown service kind/i
  );
});
