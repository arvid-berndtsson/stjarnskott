import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { renderCodexConfig, renderManagedBlock, summarizeExport } from './codex-export.ts';
import {
  GENERATED_DIR,
  GENERATED_FRAGMENT,
  GENERATED_LOGS_DIR,
  GENERATED_MANAGED_BLOCK,
  GENERATED_PROFILE,
  GENERATED_STATUS
} from './cli-paths.ts';
import type { RunningService } from './service-types.ts';

export async function writeGeneratedFiles(statuses: RunningService[], workspaceRoot: string): Promise<void> {
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
          ? 'Run "node --experimental-transform-types platforms/codex/src/cli.ts install" to merge the exported servers into ~/.codex/config.toml'
          : 'No MCP servers were exportable for this run. Check the service status messages and logs, then rerun the launcher.'
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  await writeFile(GENERATED_MANAGED_BLOCK, managedBlock, 'utf8');
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

