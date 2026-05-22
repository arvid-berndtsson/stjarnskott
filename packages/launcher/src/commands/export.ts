import { stopRunningServices } from '../service-runner.ts';
import { loadManifest } from '../manifest.ts';
import { printNextSteps, printSummary } from '../cli-output.ts';
import { writeGeneratedFiles } from '../generated-artifacts.ts';
import { selectServices, startSelectedServices } from '../service-selection.ts';
import type { CliOptions } from '../cli-types.ts';

export async function runExport(options: CliOptions): Promise<void> {
  const workspaceRoot = process.cwd();
  const manifest = await loadManifest(options.manifestPath);
  const selected = selectServices(manifest.services, options.serviceIds);
  const statuses = await startSelectedServices(selected, workspaceRoot);

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

