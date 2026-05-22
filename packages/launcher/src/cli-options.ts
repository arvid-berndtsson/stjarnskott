import { DEFAULT_MANIFEST } from './cli-paths.ts';
import type { CliOptions } from './cli-types.ts';

export function parseOptions(args: string[]): CliOptions {
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

