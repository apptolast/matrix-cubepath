import { logger } from '../lib/logger';
import { monitoringRepo } from '../repositories/monitoring.repository';
import type { MonitoringCategory, MetricSnapshot } from '../repositories/monitoring.repository';
import { collectKubernetes } from './collectors/k8s.collector';
import { collectApplications } from './collectors/app.collector';
import { collectNetwork } from './collectors/network.collector';
import { collectStorage } from './collectors/storage.collector';
import { collectDocker } from './collectors/docker.collector';
import { collectSecurity } from './collectors/security.collector';
import { collectBackups } from './collectors/backup.collector';
import { collectDatabases } from './collectors/database.collector';
import { collectIoT } from './collectors/iot.collector';

const CTX = 'monitoring';

interface CollectorConfig {
  name: string;
  fn: () => Promise<void>;
  intervalMs: number;
}

// In-memory latest results cache
const latestResults = new Map<string, { data: MetricSnapshot[]; updatedAt: string }>();

// Collector intervals
const timers: ReturnType<typeof setInterval>[] = [];

async function runCollector(c: CollectorConfig): Promise<void> {
  const start = Date.now();
  try {
    await c.fn();
    const durationMs = Date.now() - start;
    latestResults.set(c.name, {
      data: monitoringRepo.getLatestByCategory(c.name as MonitoringCategory),
      updatedAt: new Date().toISOString(),
    });
    logger.info(CTX, `Collector '${c.name}' completed in ${durationMs}ms`);
  } catch (err) {
    const durationMs = Date.now() - start;
    logger.error(CTX, `Collector '${c.name}' failed after ${durationMs}ms`, err);
  }
}

function purgeOldData(): void {
  try {
    const deleted = monitoringRepo.purgeOldSnapshots(7);
    logger.info(CTX, `Purged ${deleted} old snapshots`);
  } catch (err) {
    logger.error(CTX, 'Failed to purge old snapshots', err);
  }
}

export function startMonitoring(): void {
  if (!isMonitoringEnabled()) return;

  const collectors: CollectorConfig[] = [
    { name: 'k8s', fn: collectKubernetes, intervalMs: 60_000 },
    { name: 'database', fn: collectDatabases, intervalMs: 120_000 },
    { name: 'app', fn: collectApplications, intervalMs: 120_000 },
    { name: 'iot', fn: collectIoT, intervalMs: 120_000 },
    { name: 'network', fn: collectNetwork, intervalMs: 300_000 },
    { name: 'storage', fn: collectStorage, intervalMs: 300_000 },
    { name: 'docker', fn: collectDocker, intervalMs: 300_000 },
    { name: 'security', fn: collectSecurity, intervalMs: 600_000 },
    { name: 'backup', fn: collectBackups, intervalMs: 3_600_000 },
  ];

  // Stagger initial runs to avoid thundering herd (5s apart)
  collectors.forEach((c, i) => {
    setTimeout(() => {
      runCollector(c);
      timers.push(setInterval(() => runCollector(c), c.intervalMs));
    }, 5000 + i * 5000);
  });

  // Daily retention cleanup at startup + every 24h
  purgeOldData();
  timers.push(setInterval(purgeOldData, 24 * 60 * 60 * 1000));

  logger.info(CTX, 'Infrastructure monitoring started');
}

export function stopMonitoring(): void {
  timers.forEach((t) => clearInterval(t));
  timers.length = 0;
  logger.info(CTX, 'Infrastructure monitoring stopped');
}

export function getLatestResults(category?: string): MetricSnapshot[] {
  if (category) {
    const cached = latestResults.get(category);
    if (cached) return cached.data;

    // Fall back to DB query
    try {
      return monitoringRepo.getLatestByCategory(category as MonitoringCategory);
    } catch {
      return [];
    }
  }

  // Return all cached results merged, or fall back to DB
  if (latestResults.size > 0) {
    const all: MetricSnapshot[] = [];
    for (const entry of latestResults.values()) {
      all.push(...entry.data);
    }
    return all;
  }

  try {
    return monitoringRepo.getLatestAll();
  } catch {
    return [];
  }
}

export function isMonitoringEnabled(): boolean {
  return process.env.MONITORING_ENABLED !== 'false';
}

export async function runCollectorsManually(): Promise<void> {
  const collectors: CollectorConfig[] = [
    { name: 'k8s', fn: collectKubernetes, intervalMs: 0 },
    { name: 'database', fn: collectDatabases, intervalMs: 0 },
    { name: 'app', fn: collectApplications, intervalMs: 0 },
    { name: 'iot', fn: collectIoT, intervalMs: 0 },
    { name: 'network', fn: collectNetwork, intervalMs: 0 },
    { name: 'storage', fn: collectStorage, intervalMs: 0 },
    { name: 'docker', fn: collectDocker, intervalMs: 0 },
    { name: 'security', fn: collectSecurity, intervalMs: 0 },
    { name: 'backup', fn: collectBackups, intervalMs: 0 },
  ];

  for (const c of collectors) {
    await runCollector(c);
  }
}
