import { parseOptions } from './cli-options.ts';
import { runExport } from './commands/export.ts';
import { runInstall } from './commands/install.ts';
import { runStart } from './commands/start.ts';
import { runUninstall } from './commands/uninstall.ts';
import { runWorkflow } from './commands/workflow.ts';

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

await main();
