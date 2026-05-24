import { checkZapHealth, prepareCodexForZap } from '../../../src/index.mjs';
import type { CliOptions } from '../cli-types.ts';

export async function runPrepareZap(options: CliOptions): Promise<void> {
  const workspaceRoot = process.cwd();
  const prepareResult = await prepareCodexForZap({
    workspaceRoot,
    install: options.install,
    manifestPath: options.manifestPath,
    url: options.url,
    securityKey: options.securityKey
  });

  console.log(prepareResult.message);

  if (!prepareResult.ok) {
    process.exitCode = 1;
    return;
  }

  const health = await checkZapHealth({
    url: options.url,
    headers: options.securityKey
      ? {
          Authorization: options.securityKey.startsWith('Bearer ')
            ? options.securityKey
            : `Bearer ${options.securityKey}`
        }
      : {}
  });

  console.log(health.message);
}
