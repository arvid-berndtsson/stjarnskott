import { runBurpWorkflow } from '../../../src/index.mjs';
import type { CliOptions } from '../cli-types.ts';

export async function runWorkflow(options: CliOptions): Promise<void> {
  const workspaceRoot = process.cwd();
  const result = await runBurpWorkflow({
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
