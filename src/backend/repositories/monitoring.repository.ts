import { getMonitoringDb } from '../db/monitoring-db';

export type MonitoringCategory =
  | 'k8s'
  | 'database'
  | 'app'
  | 'network'
  | 'storage'
  | 'docker'
  | 'security'
  | 'backup'
  | 'iot';

export type ResourceStatus = 'healthy' | 'warning' | 'critical' | 'unknown';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface MetricSnapshot {
  id: number;
  category: MonitoringCategory;
  resource_type: string;
  resource_name: string;
  namespace: string | null;
  status: ResourceStatus;
  value_json: string;
  collected_at: string;
}

export interface Alert {
  id: number;
  category: MonitoringCategory;
  resource_name: string;
  severity: AlertSeverity;
  message: string;
  acknowledged: number;
  resolved_at: string | null;
  created_at: string;
}

export const monitoringRepo = {
  insertSnapshot(
    category: MonitoringCategory,
    resourceType: string,
    resourceName: string,
    namespace: string | null,
    status: ResourceStatus,
    valueJson: string,
  ): void {
    getMonitoringDb()
      .prepare(
        `INSERT INTO metric_snapshots (category, resource_type, resource_name, namespace, status, value_json, collected_at)
         VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
      )
      .run(category, resourceType, resourceName, namespace, status, valueJson);
  },

  getLatestByCategory(category: MonitoringCategory): MetricSnapshot[] {
    return getMonitoringDb()
      .prepare(
        `SELECT m.* FROM metric_snapshots m
         INNER JOIN (
           SELECT resource_name, resource_type, COALESCE(namespace, '') as ns, MAX(collected_at) as max_at
           FROM metric_snapshots
           WHERE category = ?
           GROUP BY resource_name, resource_type, ns
         ) latest ON m.resource_name = latest.resource_name
                  AND m.resource_type = latest.resource_type
                  AND COALESCE(m.namespace, '') = latest.ns
                  AND m.collected_at = latest.max_at
         WHERE m.category = ?
         ORDER BY m.resource_name`,
      )
      .all(category, category) as MetricSnapshot[];
  },

  getLatestAll(): MetricSnapshot[] {
    return getMonitoringDb()
      .prepare(
        `SELECT m.* FROM metric_snapshots m
         INNER JOIN (
           SELECT resource_name, resource_type, category, COALESCE(namespace, '') as ns, MAX(collected_at) as max_at
           FROM metric_snapshots
           GROUP BY resource_name, resource_type, category, ns
         ) latest ON m.resource_name = latest.resource_name
                  AND m.resource_type = latest.resource_type
                  AND m.category = latest.category
                  AND COALESCE(m.namespace, '') = latest.ns
                  AND m.collected_at = latest.max_at
         ORDER BY m.category, m.resource_name`,
      )
      .all() as MetricSnapshot[];
  },

  getHistory(
    resourceName: string,
    fromTime: string,
    toTime: string,
    limit = 500,
    namespace?: string,
    category?: MonitoringCategory,
  ): MetricSnapshot[] {
    let sql = `SELECT * FROM metric_snapshots WHERE resource_name = ? AND collected_at >= ? AND collected_at <= ?`;
    const params: (string | number)[] = [resourceName, fromTime, toTime];
    if (namespace !== undefined) {
      sql += ` AND COALESCE(namespace, '') = ?`;
      params.push(namespace);
    }
    if (category !== undefined) {
      sql += ` AND category = ?`;
      params.push(category);
    }
    sql += ` ORDER BY collected_at DESC LIMIT ?`;
    params.push(limit);
    return getMonitoringDb().prepare(sql).all(...params) as MetricSnapshot[];
  },

  getHistoryByCategory(
    category: MonitoringCategory,
    fromTime: string,
    toTime: string,
    limit = 500,
  ): MetricSnapshot[] {
    return getMonitoringDb()
      .prepare(
        `SELECT * FROM metric_snapshots
         WHERE category = ? AND collected_at >= ? AND collected_at <= ?
         ORDER BY collected_at DESC
         LIMIT ?`,
      )
      .all(category, fromTime, toTime, limit) as MetricSnapshot[];
  },

  // ── Alerts ────────────────────────────────────────────────────────────

  insertAlert(
    category: MonitoringCategory,
    resourceName: string,
    severity: AlertSeverity,
    message: string,
  ): void {
    // Avoid duplicate active alerts for the same resource + message
    const existing = getMonitoringDb()
      .prepare(
        `SELECT id FROM alerts
         WHERE resource_name = ? AND message = ? AND resolved_at IS NULL AND acknowledged = 0`,
      )
      .get(resourceName, message);
    if (existing) return;

    getMonitoringDb()
      .prepare(
        `INSERT INTO alerts (category, resource_name, severity, message, created_at)
         VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
      )
      .run(category, resourceName, severity, message);
  },

  findActiveAlerts(): Alert[] {
    return getMonitoringDb()
      .prepare(
        `SELECT * FROM alerts
         WHERE resolved_at IS NULL
         ORDER BY
           CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
           created_at DESC`,
      )
      .all() as Alert[];
  },

  findAllAlerts(limit = 100): Alert[] {
    return getMonitoringDb()
      .prepare(`SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as Alert[];
  },

  acknowledgeAlert(id: number): boolean {
    const result = getMonitoringDb()
      .prepare(`UPDATE alerts SET acknowledged = 1 WHERE id = ? AND acknowledged = 0`)
      .run(id);
    return result.changes > 0;
  },

  resolveAlert(resourceName: string, message: string): void {
    getMonitoringDb()
      .prepare(
        `UPDATE alerts SET resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE resource_name = ? AND message = ? AND resolved_at IS NULL`,
      )
      .run(resourceName, message);
  },

  // ── Config ────────────────────────────────────────────────────────────

  getConfig(key: string): string | undefined {
    const row = getMonitoringDb()
      .prepare(`SELECT value FROM monitoring_config WHERE key = ?`)
      .get(key) as { value: string } | undefined;
    return row?.value;
  },

  setConfig(key: string, value: string): void {
    getMonitoringDb()
      .prepare(
        `INSERT INTO monitoring_config (key, value, updated_at)
         VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value);
  },

  getAllConfig(): Record<string, string> {
    const rows = getMonitoringDb()
      .prepare(`SELECT key, value FROM monitoring_config`)
      .all() as { key: string; value: string }[];
    const config: Record<string, string> = {};
    for (const row of rows) config[row.key] = row.value;
    return config;
  },

  // ── Maintenance ───────────────────────────────────────────────────────

  purgeOldSnapshots(days = 7): number {
    const result = getMonitoringDb()
      .prepare(`DELETE FROM metric_snapshots WHERE collected_at < datetime('now', '-' || ? || ' days')`)
      .run(days);
    return result.changes;
  },

  getCategorySummary(): { category: string; total: number; healthy: number; warning: number; critical: number }[] {
    return getMonitoringDb()
      .prepare(
        `SELECT
           m.category,
           COUNT(*) as total,
           SUM(CASE WHEN m.status = 'healthy' THEN 1 ELSE 0 END) as healthy,
           SUM(CASE WHEN m.status = 'warning' THEN 1 ELSE 0 END) as warning,
           SUM(CASE WHEN m.status = 'critical' THEN 1 ELSE 0 END) as critical
         FROM metric_snapshots m
         INNER JOIN (
           SELECT resource_name, resource_type, category, MAX(collected_at) as max_at
           FROM metric_snapshots
           GROUP BY resource_name, resource_type, category
         ) latest ON m.resource_name = latest.resource_name
                  AND m.resource_type = latest.resource_type
                  AND m.category = latest.category
                  AND m.collected_at = latest.max_at
         GROUP BY m.category
         ORDER BY m.category`,
      )
      .all() as { category: string; total: number; healthy: number; warning: number; critical: number }[];
  },
};
