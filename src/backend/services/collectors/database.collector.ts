import net from 'node:net';
import { coreV1Api, isK8sAvailable } from '../k8s-client';
import { monitoringRepo } from '../../repositories/monitoring.repository';
import type { ResourceStatus } from '../../repositories/monitoring.repository';
import { logger } from '../../lib/logger';
import { parseMetrics } from '../../lib/prometheus-parser';
import type { ParsedMetric } from '../../lib/prometheus-parser';

const CTX = 'db-collector';

// ── Types ─────────────────────────────────────────────────────────────────

type DbResourceType = 'postgresql' | 'mysql' | 'redis' | 'timescaledb' | 'mqtt';

interface DatabaseTarget {
  name: string;
  namespace: string;
  host: string;
  port: number;
  resourceType: DbResourceType;
  exporterUrl?: string;
}

// ── Discovery constants ───────────────────────────────────────────────────

const DB_PORT_MAP: Record<number, DbResourceType> = {
  5432: 'postgresql',
  3306: 'mysql',
  6379: 'redis',
  1883: 'mqtt',
};

const SKIP_NAMESPACES = new Set([
  'kube-system', 'kube-public', 'kube-node-lease',
  'cattle-system', 'cattle-fleet-system', 'cattle-fleet-local-system',
  'monitoring', 'cert-manager', 'metallb-system', 'traefik',
]);

const ANNOTATION_PREFIX = 'monitoring.apptolast.com';

// ── Fallback targets (used when K8s API unavailable) ──────────────────────

const FALLBACK_TARGETS: DatabaseTarget[] = [
  { name: 'postgres-n8n', namespace: 'n8n', host: 'postgres-n8n.n8n.svc.cluster.local', port: 5432, resourceType: 'postgresql' },
  { name: 'postgresql-langflow', namespace: 'langflow', host: 'postgresql-langflow.langflow.svc.cluster.local', port: 5432, resourceType: 'postgresql' },
  { name: 'postgresql-metadata', namespace: 'apptolast-invernadero-api', host: 'postgresql-metadata.apptolast-invernadero-api.svc.cluster.local', port: 5432, resourceType: 'postgresql' },
  { name: 'timescaledb', namespace: 'apptolast-invernadero-api', host: 'timescaledb.apptolast-invernadero-api.svc.cluster.local', port: 5432, resourceType: 'timescaledb' },
  { name: 'mysql-gibbon', namespace: 'gibbon', host: 'mysql.gibbon.svc.cluster.local', port: 3306, resourceType: 'mysql' },
  { name: 'redis', namespace: 'apptolast-invernadero-api', host: 'redis.apptolast-invernadero-api.svc.cluster.local', port: 6379, resourceType: 'redis' },
  { name: 'redis-coordinator', namespace: 'n8n', host: 'redis-coordinator.n8n.svc.cluster.local', port: 6379, resourceType: 'redis' },
  { name: 'mqttinvernaderoapi', namespace: 'apptolast-invernadero-api', host: 'mqttinvernaderoapi.apptolast-invernadero-api.svc.cluster.local', port: 1883, resourceType: 'mqtt' },
];

// ── Discovery cache ───────────────────────────────────────────────────────

let cachedTargets: DatabaseTarget[] | null = null;
let cachedExporters: Map<string, string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 300_000; // 5 min

// ── Service discovery ─────────────────────────────────────────────────────

function shouldSkipService(
  name: string,
  namespace: string,
  labels: Record<string, string>,
  svcType: string,
): boolean {
  if (SKIP_NAMESPACES.has(namespace)) return true;
  // Skip external/NodePort duplicates
  if (name.endsWith('-external')) return true;
  // Skip headless duplicates (e.g. postgresql-langflow-hl)
  if (name.endsWith('-hl')) return true;
  // Skip exporters
  const appLabel = labels['app'] ?? '';
  if (appLabel.includes('-exporter') || appLabel.includes('exporter')) return true;
  // Skip LoadBalancer/ExternalName
  if (svcType === 'LoadBalancer' || svcType === 'ExternalName') return true;
  return false;
}

function detectDbType(
  port: number,
  name: string,
  annotations: Record<string, string>,
): DbResourceType | null {
  // Annotation override takes priority
  const annotatedType = annotations[`${ANNOTATION_PREFIX}/type`];
  if (annotatedType) return annotatedType as DbResourceType;

  const baseType = DB_PORT_MAP[port];
  if (!baseType) return null;

  // Refine postgresql → timescaledb based on name
  if (baseType === 'postgresql' && name.toLowerCase().includes('timescale')) {
    return 'timescaledb';
  }

  return baseType;
}

async function discoverDatabases(): Promise<DatabaseTarget[]> {
  if (!isK8sAvailable() || !coreV1Api) {
    logger.warn(CTX, 'K8s not available, using fallback targets');
    return FALLBACK_TARGETS;
  }

  try {
    const svcList = await coreV1Api.listServiceForAllNamespaces();
    const databases: DatabaseTarget[] = [];

    for (const svc of svcList.items) {
      const name = svc.metadata?.name ?? '';
      const namespace = svc.metadata?.namespace ?? '';
      const labels = svc.metadata?.labels ?? {};
      const annotations = svc.metadata?.annotations ?? {};
      const svcType = svc.spec?.type ?? 'ClusterIP';

      if (shouldSkipService(name, namespace, labels, svcType)) continue;
      if (annotations[`${ANNOTATION_PREFIX}/skip`] === 'true') continue;

      const ports = svc.spec?.ports ?? [];
      for (const p of ports) {
        const dbType = detectDbType(p.port, name, annotations);
        if (dbType) {
          databases.push({
            name,
            namespace,
            host: `${name}.${namespace}.svc.cluster.local`,
            port: p.port,
            resourceType: dbType,
            exporterUrl: annotations[`${ANNOTATION_PREFIX}/exporter-url`] ?? undefined,
          });
          break; // one entry per service
        }
      }
    }

    logger.info(CTX, `Discovered ${databases.length} database services via K8s API`);
    return databases.length > 0 ? databases : FALLBACK_TARGETS;
  } catch (err) {
    logger.warn(CTX, 'Failed to discover databases via K8s, using fallback targets', err);
    return FALLBACK_TARGETS;
  }
}

async function discoverExporters(): Promise<Map<string, string>> {
  const exporterMap = new Map<string, string>();

  if (!isK8sAvailable() || !coreV1Api) return exporterMap;

  try {
    const svcList = await coreV1Api.listServiceForAllNamespaces();

    for (const svc of svcList.items) {
      const labels = svc.metadata?.labels ?? {};
      const appLabel = labels['app'] ?? '';
      const dbLabel = labels['database'] ?? '';

      // Detect Prometheus exporters by label pattern: app=*-exporter, database=<target-name>
      if (appLabel.includes('-exporter') && dbLabel) {
        const ns = svc.metadata?.namespace ?? '';
        const svcName = svc.metadata?.name ?? '';
        const port = svc.spec?.ports?.[0]?.port ?? 9187;
        const url = `http://${svcName}.${ns}.svc.cluster.local:${port}/metrics`;
        exporterMap.set(dbLabel, url);
        logger.info(CTX, `Discovered exporter for '${dbLabel}': ${url}`);
      }
    }
  } catch (err) {
    logger.warn(CTX, 'Failed to discover exporters', err);
  }

  return exporterMap;
}

async function getTargets(): Promise<DatabaseTarget[]> {
  const now = Date.now();
  if (cachedTargets && now - cacheTimestamp < CACHE_TTL_MS) return cachedTargets;
  cachedTargets = await discoverDatabases();
  cachedExporters = await discoverExporters();
  cacheTimestamp = now;
  return cachedTargets;
}

function getExporterMap(): Map<string, string> {
  return cachedExporters ?? new Map();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function tcpConnect(host: string, port: number, timeoutMs = 5000): Promise<'online' | 'offline'> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: timeoutMs });
    socket.once('connect', () => {
      socket.destroy();
      resolve('online');
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve('offline');
    });
    socket.once('error', () => {
      socket.destroy();
      resolve('offline');
    });
  });
}

async function fetchMetrics(url: string, timeoutMs = 10000): Promise<ParsedMetric[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    return parseMetrics(text);
  } catch {
    return null;
  }
}

function findMetric(metrics: ParsedMetric[], name: string, labels?: Record<string, string>): ParsedMetric | undefined {
  return metrics.find((m) => {
    if (m.metric !== name) return false;
    if (!labels) return true;
    return Object.entries(labels).every(([k, v]) => m.labels[k] === v);
  });
}

function findAllMetrics(metrics: ParsedMetric[], name: string): ParsedMetric[] {
  return metrics.filter((m) => m.metric === name);
}

// ── Prometheus-based collectors ────────────────────────────────────────────

interface PostgresExporterData {
  up: boolean;
  connections: number;
  sizeBytes: number;
  replicationLag: number | null;
  responseTimeMs: number;
}

interface RedisExporterData {
  up: boolean;
  connectedClients: number;
  usedMemoryBytes: number;
  uptimeSeconds: number;
  responseTimeMs: number;
}

function determinePostgresStatus(data: PostgresExporterData): ResourceStatus {
  if (!data.up) return 'critical';
  if (data.connections > 100) return 'warning';
  if (data.replicationLag !== null && data.replicationLag > 1_000_000) return 'warning';
  return 'healthy';
}

function determineRedisStatus(data: RedisExporterData): ResourceStatus {
  if (!data.up) return 'critical';
  if (data.connectedClients > 500) return 'warning';
  if (data.usedMemoryBytes > 2 * 1024 * 1024 * 1024) return 'warning'; // 2GB
  return 'healthy';
}

async function collectPostgresExporter(
  url: string,
  targetName: string,
): Promise<PostgresExporterData | null> {
  const start = Date.now();
  const metrics = await fetchMetrics(url);
  const elapsed = Date.now() - start;

  if (!metrics) return null;

  const upMetric = findMetric(metrics, 'pg_up');
  if (!upMetric) return null;

  const connections = findMetric(metrics, 'pg_stat_activity_count');
  const sizeMetrics = findAllMetrics(metrics, 'pg_database_size_bytes');
  const totalSize = sizeMetrics.reduce((sum, m) => sum + m.value, 0);
  const repLag = findMetric(metrics, 'pg_stat_replication_pg_wal_lsn_diff');

  logger.info(CTX, `Collected postgres exporter data for '${targetName}' from ${url}`);

  return {
    up: upMetric.value === 1,
    connections: connections?.value ?? 0,
    sizeBytes: totalSize,
    replicationLag: repLag?.value ?? null,
    responseTimeMs: elapsed,
  };
}

async function collectRedisExporter(url: string): Promise<RedisExporterData | null> {
  const start = Date.now();
  const metrics = await fetchMetrics(url);
  const elapsed = Date.now() - start;

  if (!metrics) return null;

  const up = findMetric(metrics, 'redis_up');
  if (!up) return null;

  const clients = findMetric(metrics, 'redis_connected_clients');
  const memory = findMetric(metrics, 'redis_used_memory_bytes');
  const uptime = findMetric(metrics, 'redis_uptime_in_seconds');

  return {
    up: up.value === 1,
    connectedClients: clients?.value ?? 0,
    usedMemoryBytes: memory?.value ?? 0,
    uptimeSeconds: uptime?.value ?? 0,
    responseTimeMs: elapsed,
  };
}

// ── TCP-based checks ───────────────────────────────────────────────────────

async function checkDatabaseTcp(target: DatabaseTarget): Promise<void> {
  const start = Date.now();
  const result = await tcpConnect(target.host, target.port);
  const elapsed = Date.now() - start;

  const up = result === 'online';
  const status: ResourceStatus = up ? 'healthy' : 'critical';

  monitoringRepo.insertSnapshot(
    'database',
    target.resourceType,
    target.name,
    target.namespace,
    status,
    JSON.stringify({ up, responseTimeMs: elapsed }),
  );

  if (!up) {
    monitoringRepo.insertAlert(
      'database',
      `${target.namespace}/${target.name}`,
      'critical',
      `${target.resourceType} ${target.name} is unreachable (TCP connect failed)`,
    );
  } else {
    monitoringRepo.resolveAlert(
      `${target.namespace}/${target.name}`,
      `${target.resourceType} ${target.name} is unreachable (TCP connect failed)`,
    );
  }
}

// ── Main collection ────────────────────────────────────────────────────────

async function collectFromExporters(targets: DatabaseTarget[]): Promise<Set<string>> {
  const covered = new Set<string>();
  const exporterMap = getExporterMap();

  for (const target of targets) {
    // Check if this target has an associated exporter (via discovery or annotation)
    const exporterUrl = target.exporterUrl ?? exporterMap.get(target.name);
    if (!exporterUrl) continue;

    try {
      if (target.resourceType === 'postgresql' || target.resourceType === 'timescaledb') {
        const data = await collectPostgresExporter(exporterUrl, target.name);
        if (data) {
          const status = determinePostgresStatus(data);
          monitoringRepo.insertSnapshot(
            'database',
            target.resourceType,
            target.name,
            target.namespace,
            status,
            JSON.stringify({
              up: data.up,
              connections: data.connections,
              sizeBytes: data.sizeBytes,
              responseTimeMs: data.responseTimeMs,
            }),
          );

          if (!data.up) {
            monitoringRepo.insertAlert(
              'database',
              `${target.namespace}/${target.name}`,
              'critical',
              `PostgreSQL instance ${target.name} is down (pg_up=0)`,
            );
          } else {
            monitoringRepo.resolveAlert(
              `${target.namespace}/${target.name}`,
              `PostgreSQL instance ${target.name} is down (pg_up=0)`,
            );
          }

          covered.add(`${target.namespace}/${target.name}`);
        }
      } else if (target.resourceType === 'redis') {
        const data = await collectRedisExporter(exporterUrl);
        if (data) {
          const status = determineRedisStatus(data);
          monitoringRepo.insertSnapshot(
            'database',
            target.resourceType,
            target.name,
            target.namespace,
            status,
            JSON.stringify({
              up: data.up,
              connections: data.connectedClients,
              uptimeSeconds: data.uptimeSeconds,
              responseTimeMs: data.responseTimeMs,
            }),
          );

          covered.add(`${target.namespace}/${target.name}`);
        }
      }
    } catch (err) {
      logger.warn(CTX, `Failed to collect exporter data for ${target.name}`, err);
    }
  }

  return covered;
}

export async function collectDatabases(): Promise<void> {
  logger.info(CTX, 'Starting database collection');

  const targets = await getTargets();

  // Phase 1: Try Prometheus exporters for targets that have one
  let coveredKeys: Set<string>;
  try {
    coveredKeys = await collectFromExporters(targets);
  } catch (err) {
    logger.warn(CTX, 'Exporter collection phase failed, falling back to TCP only', err);
    coveredKeys = new Set();
  }

  // Phase 2: TCP connectivity checks for remaining targets
  const tcpPromises: Promise<void>[] = [];

  for (const target of targets) {
    const key = `${target.namespace}/${target.name}`;
    if (coveredKeys.has(key)) continue;

    tcpPromises.push(
      checkDatabaseTcp(target).catch((err) => {
        logger.error(CTX, `TCP check failed for ${target.name}`, err);
      }),
    );
  }

  await Promise.all(tcpPromises);

  logger.info(CTX, `Database collection complete: ${coveredKeys.size} from exporters, ${tcpPromises.length} TCP checks, ${targets.length} total targets`);
}
