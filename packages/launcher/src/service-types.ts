import type { ChildProcessWithoutNullStreams } from 'node:child_process';

export type HealthCheck =
  | {
      type: 'process';
      readyDelayMs?: number;
    }
  | {
      type: 'sse';
      url: string;
      timeoutMs?: number;
      intervalMs?: number;
    };

export type CodexExportConfig = {
  export: boolean;
  name?: string;
  startupTimeoutSec?: number;
};

export type ProcessServiceDefinition = {
  id: string;
  kind: 'burp-proxy' | 'stdio-mcp';
  enabled: boolean;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  health?: HealthCheck;
  codex?: CodexExportConfig;
};

export type RemoteHttpServiceDefinition = {
  id: string;
  kind: 'remote-http';
  enabled: boolean;
  url: string;
  headers?: Record<string, string>;
  codex?: CodexExportConfig;
};

export type ServiceDefinition = ProcessServiceDefinition | RemoteHttpServiceDefinition;

export type ServiceManifest = {
  services: ServiceDefinition[];
};

export type ServiceState = 'ready' | 'failed' | 'skipped';

export type ServiceStatus = {
  service: ServiceDefinition;
  state: ServiceState;
  message?: string;
  pid?: number;
};

export type RunningService = ServiceStatus & {
  child?: ChildProcessWithoutNullStreams;
  logs?: {
    stderr: string;
  };
};
