import path from 'node:path';

import type { RunningService, ServiceStatus } from './service-types.ts';

export const MANAGED_BLOCK_START = '# BEGIN stjarnskott managed mcp servers';
export const MANAGED_BLOCK_END = '# END stjarnskott managed mcp servers';

export function renderCodexConfig(statuses: ServiceStatus[], workspaceRoot?: string): string {
  const exportable = statuses
    .filter((status) => status.state === 'ready' && status.service.codex?.export)
    .sort((left, right) => exportName(left.service).localeCompare(exportName(right.service)));

  const lines: string[] = [];
  for (const status of exportable) {
    const service = status.service;
    const name = exportName(service);
    lines.push(`[mcp_servers.${name}]`);
    if (service.kind === 'remote-http') {
      lines.push(`url = ${renderTomlString(service.url)}`);
    } else {
      lines.push(`command = ${renderTomlString(resolveForConfig(service.command, workspaceRoot))}`);
      lines.push(`args = ${renderTomlArray((service.args ?? []).map((arg) => resolveForConfig(arg, workspaceRoot, false)))}`);

      if (service.cwd) {
        lines.push(`cwd = ${renderTomlString(resolveForConfig(service.cwd, workspaceRoot))}`);
      }
    }

    if (service.codex?.startupTimeoutSec !== undefined) {
      lines.push(`startup_timeout_sec = ${service.codex.startupTimeoutSec}`);
    }

    const envEntries = Object.entries(service.kind === 'remote-http' ? {} : (service.env ?? {})).sort(([left], [right]) => left.localeCompare(right));
    if (envEntries.length > 0) {
      lines.push('');
      lines.push(`[mcp_servers.${name}.env]`);
      for (const [key, value] of envEntries) {
        lines.push(`${key} = ${renderTomlString(value)}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export function renderManagedBlock(statuses: ServiceStatus[], workspaceRoot?: string): string {
  const body = renderCodexConfig(statuses, workspaceRoot).trimEnd();
  return `${MANAGED_BLOCK_START}\n${body}\n${MANAGED_BLOCK_END}\n`;
}

export function mergeManagedBlock(existingConfig: string, managedBlock: string): string {
  const pattern = new RegExp(`${escapeRegex(MANAGED_BLOCK_START)}[\\s\\S]*?${escapeRegex(MANAGED_BLOCK_END)}\\n?`, 'm');
  if (pattern.test(existingConfig)) {
    return existingConfig.replace(pattern, managedBlock);
  }

  const trimmed = existingConfig.trimEnd();
  if (trimmed.length === 0) {
    return managedBlock;
  }

  return `${trimmed}\n\n${managedBlock}`;
}

export function removeManagedBlock(existingConfig: string): string {
  const pattern = new RegExp(`${escapeRegex(MANAGED_BLOCK_START)}[\\s\\S]*?${escapeRegex(MANAGED_BLOCK_END)}\\n?`, 'm');
  const updated = existingConfig.replace(pattern, '');
  return updated.trimEnd() + (updated.trimEnd().length > 0 ? '\n' : '');
}

export function removePluginSectionsForMarketplace(existingConfig: string, marketplaceName: string): string {
  const escaped = escapeRegex(`@${marketplaceName}`);
  const pattern = new RegExp(`\\n?\\[plugins\\.\"[^\"]+${escaped}\"\\]\\n(?:[^\\[]*\\n)*`, 'g');
  const updated = existingConfig.replace(pattern, '\n');
  return updated.replace(/\n{3,}/g, '\n\n').trimEnd() + (updated.trim().length > 0 ? '\n' : '');
}

export function summarizeExport(statuses: RunningService[]): string[] {
  return statuses
    .filter((status) => status.state === 'ready' && status.service.codex?.export)
    .map((status) => exportName(status.service))
    .sort((left, right) => left.localeCompare(right));
}

function exportName(service: ServiceStatus['service']): string {
  return service.codex?.name ?? service.id;
}

function renderTomlString(value: string): string {
  return JSON.stringify(value);
}

function renderTomlArray(values: string[]): string {
  return `[${values.map((value) => renderTomlString(value)).join(', ')}]`;
}

function resolveForConfig(value: string, workspaceRoot?: string, resolveRelative = true): string {
  if (!workspaceRoot || !resolveRelative) {
    return value;
  }

  if (value.startsWith('./') || value.startsWith('../')) {
    return path.resolve(workspaceRoot, value);
  }

  return value;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
