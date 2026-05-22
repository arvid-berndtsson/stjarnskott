import { GENERATED_FRAGMENT, GENERATED_LOGS_DIR, GENERATED_PROFILE } from './cli-paths.ts';
import type { RunningService } from './service-types.ts';

export function printSummary(statuses: RunningService[]): void {
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

export function printNextSteps(): void {
  console.log(`Generated Codex profile fragment: ${GENERATED_PROFILE}`);
  console.log('To make the Codex desktop app use these MCP servers, run:');
  console.log('  node --experimental-transform-types codex/src/cli.ts install');
}

