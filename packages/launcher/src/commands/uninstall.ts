import { MARKETPLACE_NAME } from '../cli-paths.ts';
import { uninstallMarketplaceConfig } from '../config-install.ts';

export async function runUninstall(): Promise<void> {
  const { changedConfig, configPath, pluginCachePath, removedCache } = await uninstallMarketplaceConfig();

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

