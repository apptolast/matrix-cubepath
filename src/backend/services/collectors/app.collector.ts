import { coreV1Api, isK8sAvailable } from '../k8s-client';
import { monitoringRepo } from '../../repositories/monitoring.repository';
import type { ResourceStatus } from '../../repositories/monitoring.repository';
import { logger } from '../../lib/logger';

const CTX = 'app-collector';
const TIMEOUT_MS = 10_000;
const SLOW_THRESHOLD_MS = 5_000;

interface AppDefinition {
  name: string;
  namespace: string;
  healthPath: string;
  port: number;
}

const KNOWN_APPS: AppDefinition[] = [
  { name: 'n8n', namespace: 'n8n', healthPath: '/', port: 5678 },
  { name: 'langflow', namespace: 'langflow', healthPath: '/health', port: 7860 },
  { name: 'gibbon', namespace: 'gibbon', healthPath: '/', port: 80 },
  { name: 'openclaw', namespace: 'openclaw', healthPath: '/', port: 3000 },
  { name: 'minecraft-stats', namespace: 'minecraft', healthPath: '/', port: 80 },
  { name: 'passbolt', namespace: 'passbolt', healthPath: '/healthcheck/status.json', port: 443 },
  { name: 'wireguard', namespace: 'apptolast-wireguard', healthPath: '/', port: 51821 },
  { name: 'shlink', namespace: 'shlink', healthPath: '/rest/health', port: 8080 },
  { name: 'greenhouse-admin', namespace: 'apptolast-greenhouse-admin-prod', healthPath: '/', port: 80 },
  { name: 'invernaderos-api', namespace: 'apptolast-invernadero-api', healthPath: '/', port: 3000 },
  { name: 'menus-backend', namespace: 'apptolast-menus-dev', healthPath: '/', port: 3000 },
  { name: 'whoop-david-api', namespace: 'apptolast-whoop-david-api-prod', healthPath: '/', port: 3000 },
  { name: 'redisinsight', namespace: 'redisinsight', healthPath: '/', port: 5540 },
  { name: 'rancher', namespace: 'cattle-system', healthPath: '/healthz', port: 443 },
  { name: 'traefik-dashboard', namespace: 'traefik', healthPath: '/ping', port: 9000 },
];

async function resolveServiceIP(app: AppDefinition): Promise<string | null> {
  if (!isK8sAvailable() || !coreV1Api) return null;

  try {
    const svc = await coreV1Api.readNamespacedService({ name: app.name, namespace: app.namespace });
    return svc.spec?.clusterIP ?? null;
  } catch {
    return null;
  }
}

function determineStatus(statusCode: number, responseTimeMs: number): ResourceStatus {
  if (statusCode >= 200 && statusCode < 300) {
    return responseTimeMs > SLOW_THRESHOLD_MS ? 'warning' : 'healthy';
  }
  if (statusCode >= 300 && statusCode < 400) {
    return 'warning';
  }
  return 'critical';
}

async function checkApp(app: AppDefinition): Promise<void> {
  const ip = await resolveServiceIP(app);

  if (!ip) {
    monitoringRepo.insertSnapshot(
      'app',
      'application',
      app.name,
      app.namespace,
      'unknown',
      JSON.stringify({
        error: 'Could not resolve service IP',
        port: app.port,
        healthPath: app.healthPath,
      }),
    );
    return;
  }

  const protocol = app.port === 443 ? 'https' : 'http';
  const url = `${protocol}://${ip}:${app.port}${app.healthPath}`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'manual',
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;
    const status = determineStatus(response.status, responseTimeMs);

    monitoringRepo.insertSnapshot(
      'app',
      'application',
      app.name,
      app.namespace,
      status,
      JSON.stringify({
        url,
        statusCode: response.status,
        responseTimeMs,
      }),
    );
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;
    const isTimeout = err instanceof DOMException && err.name === 'AbortError';

    monitoringRepo.insertSnapshot(
      'app',
      'application',
      app.name,
      app.namespace,
      'critical',
      JSON.stringify({
        url,
        error: isTimeout ? 'Timeout' : String(err),
        responseTimeMs,
      }),
    );
  }
}

export async function collectApplications(): Promise<void> {
  for (const app of KNOWN_APPS) {
    try {
      await checkApp(app);
      logger.info(CTX, `Checked ${app.name}`);
    } catch (err) {
      logger.error(CTX, `Failed to check ${app.name}`, err);
    }
  }
}
