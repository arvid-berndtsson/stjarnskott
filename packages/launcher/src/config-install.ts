import { readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  MANAGED_BLOCK_END,
  MANAGED_BLOCK_START,
  mergeManagedBlock,
  removeManagedBlock,
  removePluginSectionsForMarketplace
} from './codex-export.ts';
import { GENERATED_PROFILE, MARKETPLACE_NAME } from './cli-paths.ts';

export async function installGeneratedProfile(): Promise<string> {
  const configPath = path.join(os.homedir(), '.codex', 'config.toml');
  const generated = await readFile(GENERATED_PROFILE, 'utf8');

  let existing = '';
  try {
    existing = await readFile(configPath, 'utf8');
  } catch {
    existing = '';
  }

  const merged = mergeManagedBlock(existing, ensureManagedBlock(generated));
  await writeFile(configPath, merged, 'utf8');
  return configPath;
}

export async function uninstallMarketplaceConfig(): Promise<{
  changedConfig: boolean;
  configPath: string;
  pluginCachePath: string;
  removedCache: boolean;
}> {
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

  return { changedConfig, configPath, pluginCachePath, removedCache };
}

function ensureManagedBlock(fragment: string): string {
  return fragment.includes(MANAGED_BLOCK_START)
    ? fragment
    : `${MANAGED_BLOCK_START}\n${fragment.trimEnd()}\n${MANAGED_BLOCK_END}\n`;
}

