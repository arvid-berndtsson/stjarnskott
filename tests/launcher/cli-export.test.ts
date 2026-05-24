import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('cli export writes a Codex-ready config artifact for a healthy stdio service', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'stjarnskott-cli-'));
  const manifestPath = path.join(dir, 'manifest.json');
  const cliPath = path.resolve('codex/src/cli.ts');
  const fixturePath = path.resolve('tests/fixtures/idle-mcp.ts');

  await writeFile(
    manifestPath,
    JSON.stringify({
      services: [
        {
          id: 'fixture',
          kind: 'stdio-mcp',
          enabled: true,
          command: process.execPath,
          args: ['--experimental-transform-types', fixturePath],
          cwd: dir,
          health: {
            type: 'process',
            readyDelayMs: 10
          },
          codex: {
            export: true
          }
        }
      ]
    }),
    'utf8'
  );

  await execFileAsync(process.execPath, ['--experimental-transform-types', cliPath, 'export', '--manifest', manifestPath], {
    cwd: dir
  });

  const artifact = await readFile(path.join(dir, 'generated/codex/mcp-servers.toml'), 'utf8');
  const logFile = await readFile(path.join(dir, 'generated/codex/logs/fixture.stderr.log'), 'utf8');
  const status = JSON.parse(await readFile(path.join(dir, 'generated/codex/status.json'), 'utf8')) as {
    exported: string[];
    nextStep: string;
  };
  assert.match(artifact, /\[mcp_servers\.fixture\]/);
  assert.match(artifact, /command = /);
  assert.equal(logFile, '');
  assert.deepEqual(status.exported, ['fixture']);
  assert.match(status.nextStep, /src\/cli\.ts install/);
});

test('cli export writes a Codex-ready config artifact for a remote HTTP service', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'stjarnskott-cli-'));
  const manifestPath = path.join(dir, 'manifest.json');
  const cliPath = path.resolve('codex/src/cli.ts');

  await writeFile(
    manifestPath,
    JSON.stringify({
      services: [
        {
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
        }
      ]
    }),
    'utf8'
  );

  await execFileAsync(process.execPath, ['--experimental-transform-types', cliPath, 'export', '--manifest', manifestPath], {
    cwd: dir
  });

  const artifact = await readFile(path.join(dir, 'generated/codex/mcp-servers.toml'), 'utf8');
  const logFile = await readFile(path.join(dir, 'generated/codex/logs/vanta.stderr.log'), 'utf8');
  const status = JSON.parse(await readFile(path.join(dir, 'generated/codex/status.json'), 'utf8')) as {
    exported: string[];
    nextStep: string;
  };

  assert.match(artifact, /\[mcp_servers\.vanta\]/);
  assert.match(artifact, /url = "https:\/\/mcp\.vanta\.com\/mcp"/);
  assert.match(artifact, /\[mcp_servers\.vanta\.headers\]/);
  assert.match(artifact, /"Authorization" = "Bearer fixture-token"/);
  assert.equal(logFile, '');
  assert.deepEqual(status.exported, ['vanta']);
  assert.match(status.nextStep, /src\/cli\.ts install/);
});

test('cli prepare-zap writes a local ignored ZAP manifest with secure settings', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'stjarnskott-cli-'));
  const cliPath = path.resolve('codex/src/cli.ts');
  await mkdir(path.join(dir, 'codex'), { recursive: true });
  await writeFile(
    path.join(dir, 'codex/services.zap.json'),
    JSON.stringify({
      services: [
        {
          id: 'zap',
          kind: 'remote-http',
          enabled: true,
          url: 'http://127.0.0.1:8282',
          codex: {
            export: true,
            name: 'zap'
          }
        }
      ]
    }),
    'utf8'
  );
  await writeFile(
    path.join(dir, 'codex/services.json'),
    JSON.stringify({
      services: [
        {
          id: 'zap',
          kind: 'remote-http',
          enabled: true,
          url: 'http://127.0.0.1:8282',
          codex: {
            export: true,
            name: 'zap'
          }
        }
      ]
    }),
    'utf8'
  );

  await execFileAsync(
    process.execPath,
    [
      '--experimental-transform-types',
      cliPath,
      'prepare-zap',
      '--manifest',
      'codex/services.zap.json',
      '--url',
      'https://127.0.0.1:8282',
      '--security-key',
      'secret-token'
    ],
    {
      cwd: dir
    }
  );

  const manifest = JSON.parse(await readFile(path.join(dir, 'codex/services.zap.json'), 'utf8')) as {
    services: Array<{ url: string; headers?: Record<string, string> }>;
  };
  const localManifest = JSON.parse(await readFile(path.join(dir, 'codex/services.zap.local.json'), 'utf8')) as {
    services: Array<{ url: string; headers?: Record<string, string> }>;
  };

  assert.equal(localManifest.services[0].url, 'https://127.0.0.1:8282');
  assert.deepEqual(localManifest.services[0].headers, {
    Authorization: 'Bearer secret-token'
  });
  assert.equal(manifest.services[0].url, 'http://127.0.0.1:8282');
  assert.equal(manifest.services[0].headers, undefined);
});
