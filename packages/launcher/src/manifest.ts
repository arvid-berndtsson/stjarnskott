import { readFile } from 'node:fs/promises';

import type { HealthCheck, ServiceDefinition, ServiceManifest } from './service-types.ts';

export async function loadManifest(filePath: string): Promise<ServiceManifest> {
  const text = await readFile(filePath, 'utf8');
  const raw = JSON.parse(text) as { services?: unknown };

  if (!Array.isArray(raw.services)) {
    throw new Error(`Manifest at ${filePath} must contain a services array.`);
  }

  return {
    services: raw.services.map(validateService)
  };
}

function validateService(raw: unknown, index: number): ServiceDefinition {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Service at index ${index} must be an object.`);
  }

  const service = raw as Record<string, unknown>;
  const id = requireString(service.id, `services[${index}].id`);
  const kind = requireKind(service.kind, `services[${index}].kind`);
  const enabled = requireBoolean(service.enabled, `services[${index}].enabled`);
  const codex = optionalCodexConfig(service.codex, `services[${index}].codex`);

  if (kind === 'remote-http') {
    const url = requireString(service.url, `services[${index}].url`);
    const headers = optionalStringMap(service.headers, `services[${index}].headers`);

    return {
      id,
      kind,
      enabled,
      url,
      headers,
      codex
    };
  }

  const command = requireString(service.command, `services[${index}].command`);
  const args = optionalStringArray(service.args, `services[${index}].args`);
  const cwd = optionalString(service.cwd, `services[${index}].cwd`);
  const env = optionalStringMap(service.env, `services[${index}].env`);
  const health = optionalHealthCheck(service.health, `services[${index}].health`);

  return {
    id,
    kind,
    enabled,
    command,
    args,
    cwd,
    env,
    health,
    codex
  };
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requireString(value, label);
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function requireKind(value: unknown, label: string): ServiceDefinition['kind'] {
  if (value === 'burp-proxy' || value === 'stdio-mcp' || value === 'remote-http') {
    return value;
  }

  throw new Error(`${label} has unknown service kind: ${String(value)}.`);
}

function optionalStringArray(value: unknown, label: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${label} must be an array of strings.`);
  }

  return value;
}

function optionalStringMap(value: unknown, label: string): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a key/value object.`);
  }

  const record = value as Record<string, unknown>;
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry !== 'string') {
      throw new Error(`${label}.${key} must be a string.`);
    }
  }

  return record as Record<string, string>;
}

function optionalHealthCheck(value: unknown, label: string): HealthCheck | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  const health = value as Record<string, unknown>;
  if (health.type === 'process') {
    if (health.readyDelayMs !== undefined && typeof health.readyDelayMs !== 'number') {
      throw new Error(`${label}.readyDelayMs must be a number.`);
    }

    return {
      type: 'process',
      readyDelayMs: health.readyDelayMs as number | undefined
    };
  }

  if (health.type === 'sse') {
    if (typeof health.url !== 'string' || health.url.length === 0) {
      throw new Error(`${label}.url must be a non-empty string.`);
    }

    if (health.timeoutMs !== undefined && typeof health.timeoutMs !== 'number') {
      throw new Error(`${label}.timeoutMs must be a number.`);
    }

    if (health.intervalMs !== undefined && typeof health.intervalMs !== 'number') {
      throw new Error(`${label}.intervalMs must be a number.`);
    }

    return {
      type: 'sse',
      url: health.url,
      timeoutMs: health.timeoutMs as number | undefined,
      intervalMs: health.intervalMs as number | undefined
    };
  }

  throw new Error(`${label}.type must be "process" or "sse".`);
}

function optionalCodexConfig(value: unknown, label: string): ServiceDefinition['codex'] {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  const codex = value as Record<string, unknown>;
  if (typeof codex.export !== 'boolean') {
    throw new Error(`${label}.export must be a boolean.`);
  }

  if (codex.name !== undefined && typeof codex.name !== 'string') {
    throw new Error(`${label}.name must be a string.`);
  }

  if (codex.startupTimeoutSec !== undefined && typeof codex.startupTimeoutSec !== 'number') {
    throw new Error(`${label}.startupTimeoutSec must be a number.`);
  }

  return {
    export: codex.export,
    name: codex.name as string | undefined,
    startupTimeoutSec: codex.startupTimeoutSec as number | undefined
  };
}
