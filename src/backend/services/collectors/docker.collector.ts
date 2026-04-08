import { monitoringRepo } from '../../repositories/monitoring.repository';
import type { ResourceStatus } from '../../repositories/monitoring.repository';
import { logger } from '../../lib/logger';

const CTX = 'docker-collector';

const REGISTRY_URL = 'http://localhost:5000/v2/_catalog';

async function collectRegistry(): Promise<void> {
  let status: ResourceStatus = 'critical';
  let responseData: Record<string, unknown> = {};

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(REGISTRY_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      status = 'healthy';
      const data = (await response.json()) as { repositories?: string[] };
      responseData = {
        statusCode: response.status,
        repositories: data.repositories ?? [],
        repositoryCount: (data.repositories ?? []).length,
      };
    } else {
      status = 'critical';
      responseData = {
        statusCode: response.status,
        statusText: response.statusText,
      };
      monitoringRepo.insertAlert(
        'docker',
        'registry',
        'critical',
        `Docker registry returned HTTP ${response.status}: ${response.statusText}`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    responseData = { error: message };
    monitoringRepo.insertAlert(
      'docker',
      'registry',
      'critical',
      `Docker registry unreachable: ${message}`,
    );
    logger.warn(CTX, 'Docker registry unreachable', err);
  }

  monitoringRepo.insertSnapshot(
    'docker',
    'registry',
    'local-registry',
    null,
    status,
    JSON.stringify(responseData),
  );
}

export async function collectDocker(): Promise<void> {
  try {
    await collectRegistry();
    logger.info(CTX, 'Collected Docker registry status');
  } catch (err) {
    logger.error(CTX, 'Failed to collect Docker status', err);
  }
}
