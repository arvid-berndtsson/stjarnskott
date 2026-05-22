import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runStjarnskottWorkflow } from '../../security-workflows/src/index.mjs';
import {
  mergeManagedBlock,
  removeManagedBlock,
  removePluginSectionsForMarketplace,
  renderCodexConfig,
  renderManagedBlock,
  summarizeExport
} from './codex-export.ts';
import { loadManifest } from './manifest.ts';
import { startService, stopRunningServices } from './service-runner.ts';
import type { RunningService, ServiceDefinition } from './service-types.ts';

const DEFAULT_MANIFEST = 'codex-workbench.services.json';
const GENERATED_DIR = path.resolve('generated/codex');
const GENERATED_LOGS_DIR = path.join(GENERATED_DIR, 'logs');
const GENERATED_FRAGMENT = path.join(GENERATED_DIR, 'mcp-servers.toml');
const GENERATED_PROFILE = path.join(GENERATED_DIR, 'stjarnskott.config.toml');
const GENERATED_STATUS = path.join(GENERATED_DIR, 'status.json');
const MARKETPLACE_NAME = 'stjarnskott';

async function main(): Promise<void> {
  const [command = 'start', ...rest] = process.argv.slice(2);
  const options = parseOptions(rest);

  switch (command) {
    case 'start':
      await runStart(options);
      return;
    case 'export':
      await runExport(options);
      return;
    case 'install':
      await runInstall();
      return;
    case 'uninstall':
      await runUninstall();
      return;
    case 'workflow':
      await runWorkflow(options);
      return;
    default:
      throw new Error(`Unknown command "${command}". Use start, export, install, uninstall, or workflow.`);
  }
}

async function runStart(options: CliOptions): Promise<void> {
  const workspaceRoot = process.cwd();
  const manifest = await loadManifest(path.resolve(options.manifestPath));
  const selected = selectServices(manifest.services, options.serviceIds);
  const statuses = await startServices(selected, workspaceRoot);
  await writeGeneratedFiles(statuses, workspaceRoot);
  printSummary(statuses);
  printNextSteps();

  const ready = statuses.filter((status) => status.state === 'ready' && status.child);
  if (ready.length === 0) {
    process.exitCode = 1;
    await stopRunningServices(statuses);
    return;
  }

  const shutdown = async () => {
    await stopRunningServices(statuses);
    process.exit(process.exitCode ?? 0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function runExport(options: CliOptions): Promise<void> {
  const workspaceRoot = process.cwd();
  const manifest = await loadManifest(path.resolve(options.manifestPath));
  const selected = selectServices(manifest.services, options.serviceIds);
  const statuses = await startServices(selected, workspaceRoot);

  try {
    await writeGeneratedFiles(statuses, workspaceRoot);
    printSummary(statuses);
    printNextSteps();
  } finally {
    await stopRunningServices(statuses);
  }

  if (statuses.some((status) => status.state === 'failed')) {
    process.exitCode = 1;
  }
}

async function runInstall(): Promise<void> {
  const configPath = path.join(os.homedir(), '.codex', 'config.toml');
  const generated = await readFile(GENERATED_PROFILE, 'utf8');

  let existing = '';
  try {
    existing = await readFile(configPath, 'utf8');
  } catch (error) {
    existing = '';
  }

  const merged = mergeManagedBlock(existing, renderManagedBlockBlock(generated));
  await writeFile(configPath, merged, 'utf8');

  console.log(`Installed managed MCP block into ${configPath}`);
  console.log('Restart the Codex desktop app or open a new Codex CLI session to pick up the changes.');
}

async function runUninstall(): Promise<void> {
  const configPath = path.join(os.homedir(), '.codex', 'config.toml');
  const pluginCachePath = path.join(os.homedir(), '.codex', 'plugins', 'cache', MARKETPLACE_NAME);

  let existing = '';
  try {
    existing = await readFile(configPath, 'utf8');
  } catch {
    existing = '';
  }

  let changedConfig = false;
  if (existing.length > 0) {
    const withoutManagedBlock = removeManagedBlock(existing);
    const cleaned = removePluginSectionsForMarketplace(withoutManagedBlock, MARKETPLACE_NAME);
    if (cleaned !== existing) {
      await writeFile(configPath, cleaned, 'utf8');
      changedConfig = true;
    }
  }

  let removedCache = false;
  try {
    await rm(pluginCachePath, { recursive: true, force: false });
    removedCache = true;
  } catch {
    removedCache = false;
  }

  if (!changedConfig && !removedCache) {
    console.log(`No managed MCP block, ${MARKETPLACE_NAME} marketplace plugin entries, or plugin cache were found to remove.`);
    return;
  }

  if (changedConfig) {
    console.log(`Removed the managed MCP block and ${MARKETPLACE_NAME} marketplace plugin entries from ${configPath}`);
  }
  if (removedCache) {
    console.log(`Removed the ${MARKETPLACE_NAME} plugin cache at ${pluginCachePath}`);
  }
  console.log('If Codex still shows the marketplace in the UI, refresh or remove that marketplace source from Codex settings.');
}

async function runWorkflow(options: CliOptions): Promise<void> {
  const workspaceRoot = process.cwd();
  const result = await runStjarnskottWorkflow({
    workspaceRoot,
    targetUrl: options.targetUrl,
    mode: options.mode
  });

  console.log(result.message);
  if (result.artifacts) {
    console.log(`Findings JSON: ${result.artifacts.findingsPath}`);
    console.log(`Markdown report: ${result.artifacts.reportPath}`);
    console.log(`Workflow status: ${result.artifacts.statusPath}`);
  }
}

async function writeGeneratedFiles(statuses: RunningService[], workspaceRoot: string): Promise<void> {
  const fragment = renderCodexConfig(statuses, workspaceRoot);
  const managedBlock = renderManagedBlock(statuses, workspaceRoot);
  const exported = summarizeExport(statuses);

  await mkdir(GENERATED_DIR, { recursive: true });
  await mkdir(GENERATED_LOGS_DIR, { recursive: true });
  await writeFile(GENERATED_FRAGMENT, fragment, 'utf8');
  await writeFile(GENERATED_PROFILE, fragment, 'utf8');
  await writeFile(
    GENERATED_STATUS,
    JSON.stringify(
      {
        exported,
        statuses: statuses.map((status) => ({
          id: status.service.id,
          state: status.state,
          message: status.message ?? null
        })),
        nextStep: exported.length > 0
          ? `Run "node --experimental-transform-types src/cli.ts install" to merge the exported servers into ~/.codex/config.toml`
          : 'No MCP servers were exportable for this run. Check the service status messages and logs, then rerun the launcher.'
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  await writeFile(path.join(GENERATED_DIR, 'managed-block.toml'), managedBlock, 'utf8');
  await Promise.all(
    statuses.map((status) =>
      writeFile(
        path.join(GENERATED_LOGS_DIR, `${status.service.id}.stderr.log`),
        status.logs?.stderr ?? '',
        'utf8'
      )
    )
  );
}

async function startServices(services: ServiceDefinition[], workspaceRoot: string): Promise<RunningService[]> {
  const statuses: RunningService[] = [];

  for (const service of services) {
    if (!service.enabled) {
      statuses.push({
        service,
        state: 'skipped',
        message: 'Service is disabled in the manifest.'
      });
      continue;
    }

    statuses.push(await startService(service, workspaceRoot));
  }

  return statuses;
}

function selectServices(services: ServiceDefinition[], serviceIds: string[]): ServiceDefinition[] {
  if (serviceIds.length === 0) {
    return services.filter((service) => service.enabled);
  }

  const selected = services.filter((service) => serviceIds.includes(service.id));
  const missing = serviceIds.filter((serviceId) => !selected.some((service) => service.id === serviceId));
  if (missing.length > 0) {
    throw new Error(`Unknown service ids: ${missing.join(', ')}.`);
  }

  return selected;
}

function printSummary(statuses: RunningService[]): void {
  const ready = statuses.filter((status) => status.state === 'ready');
  const failed = statuses.filter((status) => status.state === 'failed');
  const skipped = statuses.filter((status) => status.state === 'skipped');

  console.log(`Ready: ${ready.length}`);
  for (const status of ready) {
    console.log(`  - ${status.service.id}`);
  }

  console.log(`Failed: ${failed.length}`);
  for (const status of failed) {
    console.log(`  - ${status.service.id}: ${status.message ?? 'unknown error'}`);
  }

  console.log(`Skipped: ${skipped.length}`);
  for (const status of skipped) {
    console.log(`  - ${status.service.id}: ${status.message ?? 'skipped'}`);
  }

  console.log(`Generated Codex fragment: ${GENERATED_FRAGMENT}`);
  console.log(`Service logs: ${GENERATED_LOGS_DIR}`);
}

function printNextSteps(): void {
  console.log(`Generated Codex profile fragment: ${GENERATED_PROFILE}`);
  console.log('To make the Codex desktop app use these MCP servers, run:');
  console.log('  node --experimental-transform-types src/cli.ts install');
}

function renderManagedBlockBlock(fragment: string): string {
  return `${fragment}`.includes('# BEGIN stjarnskott managed mcp servers')
    ? fragment
    : renderManagedBlockFromFragment(fragment);
}

function renderManagedBlockFromFragment(fragment: string): string {
  return `# BEGIN stjarnskott managed mcp servers\n${fragment.trimEnd()}\n# END stjarnskott managed mcp servers\n`;
}

type CliOptions = {
  manifestPath: string;
  serviceIds: string[];
  targetUrl?: string;
  mode?: 'passive' | 'active';
};

function parseOptions(args: string[]): CliOptions {
  let manifestPath = DEFAULT_MANIFEST;
  const serviceIds: string[] = [];
  let targetUrl;
  let mode;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--manifest') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('--manifest requires a value.');
      }

      manifestPath = value;
      index += 1;
      continue;
    }

    if (arg === '--service') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('--service requires a value.');
      }

      serviceIds.push(value);
      index += 1;
      continue;
    }

    if (arg === '--target') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('--target requires a value.');
      }

      targetUrl = value;
      index += 1;
      continue;
    }

    if (arg === '--mode') {
      const value = args[index + 1];
      if (!value || (value !== 'passive' && value !== 'active')) {
        throw new Error('--mode requires either "passive" or "active".');
      }

      mode = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option "${arg}".`);
  }

  return { manifestPath, serviceIds, targetUrl, mode };
}

await main();
