import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || './data';

let monitoringDb: Database.Database | undefined;

export function getMonitoringDb(): Database.Database {
  if (!monitoringDb) throw new Error('Monitoring DB not initialized. Call initMonitoringDb() first.');
  return monitoringDb;
}

export function initMonitoringDb(): void {
  const dataDir = path.resolve(DATA_DIR);
  fs.mkdirSync(dataDir, { recursive: true });

  monitoringDb = new Database(path.join(dataDir, 'monitoring.db'));
  monitoringDb.pragma('journal_mode = WAL');
  monitoringDb.pragma('foreign_keys = ON');

  monitoringDb.exec(`
    CREATE TABLE IF NOT EXISTS metric_snapshots (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      category      TEXT    NOT NULL,
      resource_type TEXT    NOT NULL,
      resource_name TEXT    NOT NULL,
      namespace     TEXT,
      status        TEXT    NOT NULL,
      value_json    TEXT    NOT NULL,
      collected_at  TEXT    NOT NULL
    )
  `);

  monitoringDb.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      category      TEXT    NOT NULL,
      resource_name TEXT    NOT NULL,
      severity      TEXT    NOT NULL,
      message       TEXT    NOT NULL,
      acknowledged  INTEGER NOT NULL DEFAULT 0,
      resolved_at   TEXT,
      created_at    TEXT    NOT NULL
    )
  `);

  monitoringDb.exec(`
    CREATE TABLE IF NOT EXISTS monitoring_config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Indexes for efficient queries
  monitoringDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_category_collected
      ON metric_snapshots (category, collected_at);
    CREATE INDEX IF NOT EXISTS idx_snapshots_resource_collected
      ON metric_snapshots (resource_name, collected_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity_ack
      ON alerts (severity, acknowledged);
    CREATE INDEX IF NOT EXISTS idx_alerts_created
      ON alerts (created_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_resource_message_resolved
      ON alerts (resource_name, message, resolved_at);
  `);

  // Retention cleanup: remove snapshots older than 7 days on startup
  monitoringDb
    .prepare(`DELETE FROM metric_snapshots WHERE collected_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')`)
    .run();

  // Resolve alerts older than 24h that haven't been acknowledged
  monitoringDb
    .prepare(`UPDATE alerts SET resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE resolved_at IS NULL AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-24 hours')`)
    .run();
}

export function closeMonitoringDb(): void {
  if (monitoringDb) {
    monitoringDb.close();
    monitoringDb = undefined;
  }
}
