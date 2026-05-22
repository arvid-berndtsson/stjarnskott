import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type PluginConfig = {
  name: string;
  skills?: string;
  mcpServers?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  interface: {
    displayName: string;
    shortDescription: string;
    brandColor?: string;
    composerIcon?: string;
    logo?: string;
  };
};

test('Burp and Vanta plugins expose separate Codex plugin bundles', async () => {
  const burpPlugin = JSON.parse(
    await readFile(path.resolve('./plugins/burp/.codex-plugin/plugin.json'), 'utf8')
  ) as PluginConfig;
  const vantaPlugin = JSON.parse(
    await readFile(path.resolve('./plugins/vanta/.codex-plugin/plugin.json'), 'utf8')
  ) as PluginConfig;

  assert.equal(burpPlugin.name, 'burp');
  assert.equal(burpPlugin.interface.displayName, 'Burp');
  assert.equal(burpPlugin.mcpServers, './.mcp.json');
  assert.equal(burpPlugin.homepage, 'https://github.com/arvid-berndtsson/stjarnskott');
  assert.equal(burpPlugin.interface.composerIcon, './assets/burp-icon.svg');
  assert.equal(burpPlugin.interface.logo, './assets/burp-icon.svg');
  assert.equal(burpPlugin.interface.brandColor, '#0B5FFF');
  assert.equal(vantaPlugin.name, 'vanta');
  assert.equal(vantaPlugin.interface.displayName, 'Vanta');
  assert.equal(vantaPlugin.skills, './skills/');
  assert.equal(vantaPlugin.mcpServers, './.mcp.json');
  assert.equal(vantaPlugin.homepage, 'https://github.com/arvid-berndtsson/stjarnskott');
  assert.equal(vantaPlugin.interface.composerIcon, './assets/vanta-icon.svg');
  assert.equal(vantaPlugin.interface.logo, './assets/vanta-icon.svg');
  assert.equal(vantaPlugin.interface.brandColor, '#1B3A2F');
});

test('split manifest files isolate Burp and Vanta services', async () => {
  const burpManifest = JSON.parse(
    await readFile(path.resolve('codex/services.burp.json'), 'utf8')
  ) as { services: Array<{ id: string }> };
  const vantaManifest = JSON.parse(
    await readFile(path.resolve('codex/services.vanta.json'), 'utf8')
  ) as { services: Array<{ id: string }> };

  assert.deepEqual(burpManifest.services.map((service) => service.id), ['burp']);
  assert.deepEqual(vantaManifest.services.map((service) => service.id), ['vanta']);
});

test('repo marketplace exposes separate Stjarnskott plugin install choices', async () => {
  const marketplace = JSON.parse(
    await readFile(path.resolve('./.agents/plugins/marketplace.json'), 'utf8')
  ) as {
    name: string;
    interface: { displayName: string };
    plugins: Array<{ name: string; source: { path: string } }>;
  };

  assert.equal(marketplace.name, 'stjarnskott');
  assert.equal(marketplace.interface.displayName, 'Stjarnskott');
  assert.deepEqual(
    marketplace.plugins.map((plugin) => plugin.name),
    ['burp', 'vanta']
  );
  assert.deepEqual(
    marketplace.plugins.map((plugin) => plugin.source.path),
    [
      './plugins/burp',
      './plugins/vanta'
    ]
  );
});
