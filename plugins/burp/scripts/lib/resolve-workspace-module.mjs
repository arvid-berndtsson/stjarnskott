import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function findWorkspaceRoot({ startDir = process.cwd(), searchHome = true } = {}) {
  const explicit = process.env.STJARNSKOTT_WORKSPACE_ROOT;
  if (explicit) {
    const found = await findMarkerRoot(path.resolve(explicit));
    if (found) {
      return found;
    }
  }

  const local = await findMarkerRoot(path.resolve(startDir));
  if (local) {
    return local;
  }

  const pwd = process.env.PWD;
  if (pwd) {
    const fromPwd = await findMarkerRoot(path.resolve(pwd));
    if (fromPwd) {
      return fromPwd;
    }
  }

  if (!searchHome) {
    return null;
  }

  for (const candidate of homeSearchCandidates()) {
    const found = await findMarkerRoot(candidate);
    if (found) {
      return found;
    }
  }

  return null;
}

export async function loadSecurityWorkflowModule({ workspaceRoot, startDir } = {}) {
  const root = workspaceRoot ?? await findWorkspaceRoot({ startDir });
  if (!root) {
    throw new Error('Could not find a Stjarnskott workspace. Open Codex in the repository root or pass workspace_root explicitly.');
  }

  const modulePath = path.join(root, 'packages', 'security-workflows', 'src', 'index.mjs');
  return {
    workspaceRoot: root,
    module: await import(pathToFileURL(modulePath).href)
  };
}

async function findMarkerRoot(startDir) {
  let current = startDir;
  while (true) {
    const marker = path.join(current, 'codex/services.json');
    try {
      await readFile(marker, 'utf8');
      return current;
    } catch {}

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function homeSearchCandidates() {
  const home = os.homedir();
  return [
    path.join(home, 'Work'),
    path.join(home, 'code'),
    path.join(home, 'Code'),
    path.join(home, 'dev'),
    path.join(home, 'Developer')
  ];
}
