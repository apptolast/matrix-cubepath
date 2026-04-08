import net from 'node:net';
import { monitoringRepo } from '../../repositories/monitoring.repository';
import type { ResourceStatus } from '../../repositories/monitoring.repository';
import { logger } from '../../lib/logger';
import { parseMetrics } from '../../lib/prometheus-parser';
import type { ParsedMetric } from '../../lib/prometheus-parser';

const CTX = 'db-collector';

// ── Known database services ────────────────────────────────────────────────

interface DatabaseTarget {
  name: string;
  namespace: string;
  host: string;
  port: number;
  resourceType: 'postgresql' | 'mysql' | 'redis' | 'timescaledb' | 'mqtt';
}

const DATABASE_TARGETS: DatabaseTarget[] = [
  { name: 'postgres-n8n', namespace: 'n8n', host: 'postgres-n8n.n8n.svc.cluster.local', port: 5432, resourceType: 'postgresql' },
  { name: 'postgresql-langflow', namespace: 'langflow', host: 'postgresql-langflow.langflow.svc.cluster.local', port: 5432, resourceType: 'postgresql' },
  { name: 'postgres-metadata', namespace: 'apptolast-invernadero-api', host: 'postgres-metadata.apptolast-invernadero-api.svc.cluster.local', port: 5432, resourceType: 'postgresql' },
  { name: 'timescaledb', namespace: 'apptolast-invernadero-api', host: 'timescaledb.apptolast-invernadero-api.svc.cluster.local', port: 5432, resourceType: 'timescaledb' },
  { name: 'mysql-gibbon', namespace: 'gibbon', host: 'mysql-gibbon.gibbon.svc.cluster.local', port: 3306, resourceType: 'mysql' },
  { name: 'redis-db', namespace: 'default', host: 'redis-db.default.svc.cluster.local', port: 6379, resourceType: 'redis' },
  { name: 'redis-coordinator', namespace: 'n8n', host: 'redis-coordinator.n8n.svc.cluster.local', port: 6379, resourceType: 'redis' },
  { name: 'redis', namespace: 'apptolast-invernadero-api', host: 'redis.apptolast-invernadero-api.svc.cluster.local', port: 6379, resourceType: 'redis' },
  { name: 'emqx', namespace: 'apptolast-invernadero-api', host: 'emqx.apptolast-invernadero-api.svc.cluster.local', port: 1883, resourceType: 'mqtt' },
];

// ── Exporter endpoints ─────────────────────────────────────────────────────

const POSTGRES_EXPORTER_URL =
  process.env.POSTGRES_EXPORTER_URL ??
  'http://postgres-exporter.monitoring.svc.cluster.local:9187/metrics';

const REDIS_EXPORTER_URL =
  process.env.REDIS_EXPORTER_URL ??
  'http://redis-exporter.monitoring.svc.cluster.local:9121/metrics';

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

async function collectPostgresExporter(): Promise<Map<string, PostgresExporterData> | null> {
  const start = Date.now();
  const metrics = await fetchMetrics(POSTGRES_EXPORTER_URL);
  const elapsed = Date.now() - start;

  if (!metrics) return null;

  const pgUpMetrics = findAllMetrics(metrics, 'pg_up');
  if (pgUpMetrics.length === 0) {
    // Check for single instance exporter
    const singleUp = findMetric(metrics, 'pg_up');
    if (!singleUp) return null;

    const data = new Map<string, PostgresExporterData>();
    const connections = findMetric(metrics, 'pg_stat_activity_count');
    const sizeMetrics = findAllMetrics(metrics, 'pg_database_size_bytes');
    const totalSize = sizeMetrics.reduce((sum, m) => sum + m.value, 0);
    const repLag = findMetric(metrics, 'pg_stat_replication_pg_wal_lsn_diff');

    data.set('postgres', {
      up: singleUp.value === 1,
      connections: connections?.value ?? 0,
      sizeBytes: totalSize,
      replicationLag: repLag?.value ?? null,
      responseTimeMs: elapsed,
    });
    return data;
  }

  const data = new Map<string, PostgresExporterData>();
  for (const upMetric of pgUpMetrics) {
    const server = upMetric.labels['server'] ?? 'postgres';
    const connections = findMetric(metrics, 'pg_stat_activity_count', { server });
    const sizeMetrics = findAllMetrics(metrics, 'pg_database_size_bytes').filter(
      (m) => m.labels['server'] === server,
    );
    const totalSize = sizeMetrics.reduce((sum, m) => sum + m.value, 0);
    const repLag = findMetric(metrics, 'pg_stat_replication_pg_wal_lsn_diff', { server });

    data.set(server, {
      up: upMetric.value === 1,
      connections: connections?.value ?? 0,
      sizeBytes: totalSize,
      replicationLag: repLag?.value ?? null,
      responseTimeMs: elapsed,
    });
  }

  return data;
}

interface RedisExporterData {
  up: boolean;
  connectedClients: number;
  usedMemoryBytes: number;
  uptimeSeconds: number;
  responseTimeMs: number;
}

async function collectRedisExporter(): Promise<RedisExporterData | null> {
  const start = Date.now();
  const metrics = await fetchMetrics(REDIS_EXPORTER_URL);
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

  const valueJson = JSON.stringify({
    up,
    responseTimeMs: elapsed,
  });

  monitoringRepo.insertSnapshot(
    'database',
    target.resourceType,
    target.name,
    target.namespace,
    status,
    valueJson,
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

async function collectFromExporters(): Promise<Set<string>> {
  const covered = new Set<string>();

  // ── Postgres exporter ──
  try {
    const pgData = await collectPostgresExporter();
    if (pgData) {
      for (const [server, data] of pgData) {
        const matchingTarget = DATABASE_TARGETS.find(
          (t) =>
            (t.resourceType === 'postgresql' || t.resourceType === 'timescaledb') &&
            (server.includes(t.name) || t.name.includes(server)),
        );

        const name = matchingTarget?.name ?? server;
        const namespace = matchingTarget?.namespace ?? null;
        const resourceType = matchingTarget?.resourceType ?? 'postgresql';
        const status = determinePostgresStatus(data);

        monitoringRepo.insertSnapshot(
          'database',
          resourceType,
          name,
          namespace,
          status,
          JSON.stringify({
            up: data.up,
            connections: data.connections,
            sizeBytes: data.sizeBytes,
            responseTimeMs: data.responseTimeMs,
          }),
        );

        if (matchingTarget) covered.add(matchingTarget.name);

        if (!data.up) {
          monitoringRepo.insertAlert(
            'database',
            `${namespace ?? 'default'}/${name}`,
            'critical',
            `PostgreSQL instance ${name} is down (pg_up=0)`,
          );
        } else {
          monitoringRepo.resolveAlert(
            `${namespace ?? 'default'}/${name}`,
            `PostgreSQL instance ${name} is down (pg_up=0)`,
          );
        }
      }
      logger.info(CTX, `Collected postgres exporter data for ${pgData.size} instance(s)`);
    }
  } catch (err) {
    logger.warn(CTX, 'Failed to collect from postgres exporter', err);
  }

  // ── Redis exporter ──
  try {
    const redisData = await collectRedisExporter();
    if (redisData) {
      const status = determineRedisStatus(redisData);

      monitoringRepo.insertSnapshot(
        'database',
        'redis',
        'redis-exporter',
        null,
        status,
        JSON.stringify({
          up: redisData.up,
          connections: redisData.connectedClients,
          uptimeSeconds: redisData.uptimeSeconds,
          responseTimeMs: redisData.responseTimeMs,
        }),
      );

      logger.info(CTX, 'Collected redis exporter data');
    }
  } catch (err) {
    logger.warn(CTX, 'Failed to collect from redis exporter', err);
  }

  return covered;
}

export async function collectDatabases(): Promise<void> {
  logger.info(CTX, 'Starting database collection');

  // Phase 1: Try Prometheus exporters
  let coveredByExporter: Set<string>;
  try {
    coveredByExporter = await collectFromExporters();
  } catch (err) {
    logger.warn(CTX, 'Exporter collection phase failed, falling back to TCP only', err);
    coveredByExporter = new Set();
  }

  // Phase 2: TCP connectivity checks for remaining targets
  const tcpPromises: Promise<void>[] = [];

  for (const target of DATABASE_TARGETS) {
    if (coveredByExporter.has(target.name)) {
      continue;
    }

    tcpPromises.push(
      checkDatabaseTcp(target).catch((err) => {
        logger.error(CTX, `TCP check failed for ${target.name}`, err);
      }),
    );
  }

  await Promise.all(tcpPromises);

  logger.info(CTX, `Database collection complete: ${coveredByExporter.size} from exporters, ${tcpPromises.length} TCP checks`);
}
