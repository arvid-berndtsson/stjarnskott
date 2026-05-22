import { installGeneratedProfile } from '../config-install.ts';

export async function runInstall(): Promise<void> {
  const configPath = await installGeneratedProfile();
  console.log(`Installed managed MCP block into ${configPath}`);
  console.log('Restart the Codex desktop app or open a new Codex CLI session to pick up the changes.');
}

