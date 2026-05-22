import path from 'node:path';

export const DEFAULT_MANIFEST = 'codex/services.json';
export const GENERATED_DIR = path.resolve('generated/codex');
export const GENERATED_LOGS_DIR = path.join(GENERATED_DIR, 'logs');
export const GENERATED_FRAGMENT = path.join(GENERATED_DIR, 'mcp-servers.toml');
export const GENERATED_PROFILE = path.join(GENERATED_DIR, 'stjarnskott.config.toml');
export const GENERATED_STATUS = path.join(GENERATED_DIR, 'status.json');
export const GENERATED_MANAGED_BLOCK = path.join(GENERATED_DIR, 'managed-block.toml');
export const MARKETPLACE_NAME = 'stjarnskott';

