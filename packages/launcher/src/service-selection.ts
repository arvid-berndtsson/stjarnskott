import { startService } from './service-runner.ts';
import type { RunningService, ServiceDefinition } from './service-types.ts';

export function selectServices(services: ServiceDefinition[], serviceIds: string[]): ServiceDefinition[] {
  if (serviceIds.length === 0) {
    return services.filter((service) => service.enabled);
  }

  const selected = services.filter((service) => serviceIds.includes(service.id));
  const missing = serviceIds.filter((serviceId) => !selected.some((service) => service.id === serviceId));
  if (missing.length > 0) {
    throw new Error(`Unknown service ids: ${missing.join(', ')}.`);
  }

  return selected;
}

export async function startSelectedServices(
  services: ServiceDefinition[],
  workspaceRoot: string
): Promise<RunningService[]> {
  const statuses: RunningService[] = [];

  for (const service of services) {
    if (!service.enabled) {
      statuses.push({
        service,
        state: 'skipped',
        message: 'Service is disabled in the manifest.'
      });
      continue;
    }

    statuses.push(await startService(service, workspaceRoot));
  }

  return statuses;
}

