import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeManagedBlock,
  removeManagedBlock,
  removePluginSectionsForMarketplace,
  renderCodexConfig,
  renderManagedBlock
} from '../../packages/launcher/src/codex-export.ts';
import type { ServiceStatus } from '../../packages/launcher/src/service-types.ts';

test('renderCodexConfig emits Codex mcp_servers TOML for healthy exported services', () => {
  const statuses: ServiceStatus[] = [
    {
      service: {
        id: 'burp',
        kind: 'burp-proxy',
        enabled: true,
        command: 'node',
        args: ['./plugins/burp/scripts/launch-burp-proxy.mjs'],
        cwd: '/workspace',
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
      state: 'ready'
    },
    {
      service: {
        id: 'vanta',
        kind: 'remote-http',
        enabled: true,
        url: 'https://mcp.vanta.com/mcp',
        headers: {
          Authorization: 'Bearer fixture-token'
        },
        codex: {
          export: true
        }
      },
      state: 'ready'
    },
    {
      service: {
        id: 'skip-me',
        kind: 'stdio-mcp',
        enabled: true,
        command: 'node',
        args: ['skip.ts'],
        health: {
          type: 'process'
        },
        codex: {
          export: true
        }
      },
      state: 'failed',
      message: 'failed on purpose'
    }
  ];

  const output = renderCodexConfig(statuses);

  assert.match(output, /\[mcp_servers\.burp\]/);
  assert.match(output, /command = "node"/);
  assert.match(output, /args = \["\.\/plugins\/burp\/scripts\/launch-burp-proxy\.mjs"\]/);
  assert.match(output, /\[mcp_servers\.vanta\]/);
  assert.match(output, /url = "https:\/\/mcp\.vanta\.com\/mcp"/);
  assert.match(output, /\[mcp_servers\.vanta\.headers\]/);
  assert.match(output, /"Authorization" = "Bearer fixture-token"/);
  assert.doesNotMatch(output, /skip-me/);
});

test('mergeManagedBlock replaces an existing managed block cleanly', () => {
  const statuses: ServiceStatus[] = [
    {
      service: {
        id: 'fixture',
        kind: 'stdio-mcp',
        enabled: true,
        command: 'node',
        args: ['fixture.ts'],
        health: {
          type: 'process'
        },
        codex: {
          export: true
        }
      },
      state: 'ready'
    }
  ];

  const existing = [
    'model = "gpt-5.4"',
    '',
    '# BEGIN stjarnskott managed mcp servers',
    '[mcp_servers.old]',
    'command = "old"',
    '# END stjarnskott managed mcp servers'
  ].join('\n');

  const merged = mergeManagedBlock(existing, renderManagedBlock(statuses));

  assert.match(merged, /\[mcp_servers\.fixture\]/);
  assert.doesNotMatch(merged, /\[mcp_servers\.old\]/);
  assert.match(merged, /model = "gpt-5\.4"/);
});

test('removeManagedBlock removes the managed MCP block cleanly', () => {
  const existing = [
    'model = "gpt-5.4"',
    '',
    '# BEGIN stjarnskott managed mcp servers',
    '[mcp_servers.old]',
    'command = "old"',
    '# END stjarnskott managed mcp servers',
    '',
    '[plugins."burp@stjarnskott"]',
    'enabled = true'
  ].join('\n');

  const updated = removeManagedBlock(existing);

  assert.doesNotMatch(updated, /BEGIN stjarnskott managed mcp servers/);
  assert.match(updated, /model = "gpt-5\.4"/);
  assert.match(updated, /\[plugins\."burp@stjarnskott"\]/);
});

test('removePluginSectionsForMarketplace removes stjarnskott marketplace plugin entries', () => {
  const existing = [
    'model = "gpt-5.4"',
    '',
    '[plugins."burp@stjarnskott"]',
    'enabled = true',
    'installed_version = "0.1.0"',
    '',
    '[plugins."vanta@stjarnskott"]',
    'enabled = true',
    '',
    '[plugins."codex_apps@openai"]',
    'enabled = true'
  ].join('\n');

  const updated = removePluginSectionsForMarketplace(existing, 'stjarnskott');

  assert.doesNotMatch(updated, /\[plugins\."burp@stjarnskott"\]/);
  assert.doesNotMatch(updated, /\[plugins\."vanta@stjarnskott"\]/);
  assert.match(updated, /\[plugins\."codex_apps@openai"\]/);
  assert.match(updated, /model = "gpt-5\.4"/);
});
