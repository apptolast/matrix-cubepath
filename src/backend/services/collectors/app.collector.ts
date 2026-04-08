import { coreV1Api, isK8sAvailable } from '../k8s-client';
import { monitoringRepo } from '../../repositories/monitoring.repository';
import type { ResourceStatus } from '../../repositories/monitoring.repository';
import { logger } from '../../lib/logger';

const CTX = 'app-collector';
const TIMEOUT_MS = 10_000;
const SLOW_THRESHOLD_MS = 5_000;

const ANNOTATION_PREFIX = 'monitoring.apptolast.com';

// ── Types ─────────────────────────────────────────────────────────────────

interface AppDefinition {
  name: string;
  namespace: string;
  healthPath: string;
  port: number;
  https?: boolean;
}

// ── Known app overrides (health path / port / protocol) ───────────────────
// These override auto-discovered defaults for apps that need special config.

const APP_OVERRIDES: Record<string, Partial<AppDefinition>> = {
  'n8n':               { healthPath: '/', port: 5678 },
  'langflow':          { healthPath: '/health', port: 7860 },
  'gibbon':            { healthPath: '/' },
  'openclaw':          { healthPath: '/' },
  'minecraft-stats':   { healthPath: '/' },
  'passbolt':          { healthPath: '/healthcheck/status.json', https: true },
  'wireguard':         { healthPath: '/' },
  'shlink':            { healthPath: '/rest/health' },
  'greenhouse-admin':  { healthPath: '/' },
  'invernaderos-api':  { healthPath: '/' },
  'menus-backend':     { healthPath: '/' },
  'whoop-david-api':   { healthPath: '/' },
  'redisinsight':      { healthPath: '/' },
  'rancher':           { healthPath: '/healthz', https: true },
  'traefik-dashboard': { healthPath: '/ping', port: 9000 },
};

// Known database ports to exclude from app discovery
const DB_PORTS = new Set([5432, 3306, 6379, 1883, 27017]);

const SKIP_NAMESPACES = new Set([
  'kube-system', 'kube-public', 'kube-node-lease',
  'cattle-system', 'cattle-fleet-system', 'cattle-fleet-local-system',
  'monitoring', 'cert-manager', 'metallb-system',
]);

// ── Discovery cache ───────────────────────────────────────────────────────

let cachedApps: AppDefinition[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 300_000; // 5 min

// ── Fallback: static app list ─────────────────────────────────────────────

const FALLBACK_APPS: AppDefinition[] = [
  { name: 'n8n', namespace: 'n8n', healthPath: '/', port: 5678 },
  { name: 'langflow', namespace: 'langflow', healthPath: '/health', port: 7860 },
  { name: 'gibbon', namespace: 'gibbon', healthPath: '/', port: 80 },
  { name: 'openclaw', namespace: 'openclaw', healthPath: '/', port: 3000 },
  { name: 'minecraft-stats', namespace: 'minecraft', healthPath: '/', port: 80 },
  { name: 'passbolt', namespace: 'passbolt', healthPath: '/healthcheck/status.json', port: 443, https: true },
  { name: 'wireguard', namespace: 'apptolast-wireguard', healthPath: '/', port: 51821 },
  { name: 'shlink', namespace: 'shlink', healthPath: '/rest/health', port: 8080 },
  { name: 'greenhouse-admin', namespace: 'apptolast-greenhouse-admin-prod', healthPath: '/', port: 80 },
  { name: 'invernaderos-api', namespace: 'apptolast-invernadero-api', healthPath: '/', port: 3000 },
  { name: 'menus-backend', namespace: 'apptolast-menus-dev', healthPath: '/', port: 3000 },
  { name: 'whoop-david-api', namespace: 'apptolast-whoop-david-api-prod', healthPath: '/', port: 3000 },
  { name: 'redisinsight', namespace: 'redisinsight', healthPath: '/', port: 5540 },
  { name: 'rancher', namespace: 'cattle-system', healthPath: '/healthz', port: 443, https: true },
  { name: 'traefik-dashboard', namespace: 'traefik', healthPath: '/ping', port: 9000 },
];

// ── Discovery ─────────────────────────────────────────────────────────────

function shouldSkipAppService(
  name: string,
  namespace: string,
  labels: Record<string, string>,
  ports: { port: number }[],
): boolean {
  if (SKIP_NAMESPACES.has(namespace)) return true;
  if (name.endsWith('-external') || name.endsWith('-hl')) return true;

  const appLabel = labels['app'] ?? '';
  if (appLabel.includes('-exporter') || appLabel.includes('exporter')) return true;

  // Skip if all ports are database ports
  if (ports.length > 0 && ports.every((p) => DB_PORTS.has(p.port))) return true;

  return false;
}

async function discoverApps(): Promise<AppDefinition[]> {
  if (!isK8sAvailable() || !coreV1Api) {
    logger.warn(CTX, 'K8s not available, using fallback apps');
    return FALLBACK_APPS;
  }

  try {
    const svcList = await coreV1Api.listServiceForAllNamespaces();
    const apps: AppDefinition[] = [];
    const seenKeys = new Set<string>();

    for (const svc of svcList.items) {
      const name = svc.metadata?.name ?? '';
      const namespace = svc.metadata?.namespace ?? '';
      const labels = svc.metadata?.labels ?? {};
      const annotations = svc.metadata?.annotations ?? {};
      const svcType = svc.spec?.type ?? 'ClusterIP';
      const ports = (svc.spec?.ports ?? []).map((p) => ({ port: p.port }));

      if (svcType === 'LoadBalancer' || svcType === 'ExternalName') continue;
      if (shouldSkipAppService(name, namespace, labels, ports)) continue;
      if (annotations[`${ANNOTATION_PREFIX}/skip`] === 'true') continue;

      // Skip services that look like databases (already monitored by db collector)
      const hasOnlyDbPorts = ports.length > 0 && ports.every((p) => DB_PORTS.has(p.port));
      if (hasOnlyDbPorts) continue;

      const key = `${namespace}/${name}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      // Apply overrides or use defaults
      const override = APP_OVERRIDES[name];
      const annotPort = annotations[`${ANNOTATION_PREFIX}/port`];
      const annotHealth = annotations[`${ANNOTATION_PREFIX}/health-path`];
      const annotHttps = annotations[`${ANNOTATION_PREFIX}/https`];

      const port = annotPort
        ? parseInt(annotPort, 10)
        : override?.port ?? ports[0]?.port ?? 80;

      const healthPath = annotHealth ?? override?.healthPath ?? '/';
      const https = annotHttps === 'true' || override?.https || port === 443;

      apps.push({ name, namespace, healthPath, port, https });
    }

    logger.info(CTX, `Discovered ${apps.length} application services via K8s API`);
    return apps.length > 0 ? apps : FALLBACK_APPS;
  } catch (err) {
    logger.warn(CTX, 'Failed to discover apps via K8s, using fallback list', err);
    return FALLBACK_APPS;
  }
}

async function getApps(): Promise<AppDefinition[]> {
  const now = Date.now();
  if (cachedApps && now - cacheTimestamp < CACHE_TTL_MS) return cachedApps;
  cachedApps = await discoverApps();
  cacheTimestamp = now;
  return cachedApps;
}

// ── Health checking ───────────────────────────────────────────────────────

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

  const protocol = app.https ? 'https' : 'http';
  const url = `${protocol}://${ip}:${app.port}${app.healthPath}`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
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

    // Generate alerts for critical apps
    if (status === 'critical') {
      monitoringRepo.insertAlert(
        'app',
        `${app.namespace}/${app.name}`,
        'critical',
        `Application ${app.name} returned HTTP ${response.status}`,
      );
    } else {
      monitoringRepo.resolveAlert(
        `${app.namespace}/${app.name}`,
        `Application ${app.name} returned HTTP ${response.status}`,
      );
    }
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;
    const isTimeout = err instanceof DOMException && err.name === 'AbortError';
    const errorMsg = isTimeout ? 'Timeout' : String(err);

    monitoringRepo.insertSnapshot(
      'app',
      'application',
      app.name,
      app.namespace,
      'critical',
      JSON.stringify({
        url,
        error: errorMsg,
        responseTimeMs,
      }),
    );

    monitoringRepo.insertAlert(
      'app',
      `${app.namespace}/${app.name}`,
      'critical',
      `Application ${app.name} is unreachable: ${errorMsg}`,
    );
  }
}

export async function collectApplications(): Promise<void> {
  const apps = await getApps();

  // Run health checks in parallel for speed
  const results = await Promise.allSettled(
    apps.map((app) => checkApp(app)),
  );

  let succeeded = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') succeeded++;
    else {
      failed++;
      logger.error(CTX, 'App check failed', r.reason);
    }
  }

  logger.info(CTX, `App collection complete: ${succeeded} ok, ${failed} errors, ${apps.length} total`);
}
