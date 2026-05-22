import { stopRunningServices } from '../service-runner.ts';
import { loadManifest } from '../manifest.ts';
import { printNextSteps, printSummary } from '../cli-output.ts';
import { writeGeneratedFiles } from '../generated-artifacts.ts';
import { selectServices, startSelectedServices } from '../service-selection.ts';
import type { CliOptions } from '../cli-types.ts';

export async function runStart(options: CliOptions): Promise<void> {
  const workspaceRoot = process.cwd();
  const manifest = await loadManifest(options.manifestPath);
  const selected = selectServices(manifest.services, options.serviceIds);
  const statuses = await startSelectedServices(selected, workspaceRoot);
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

