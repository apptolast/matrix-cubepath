import React, { useMemo } from 'react';
import { useDatabases, MonitoringSnapshot } from '../../hooks/useMonitoring';
import { StatusBadge } from './shared/StatusBadge';
import { ErrorState } from './shared/ErrorState';
import { Skeleton } from '../ui/Skeleton';

interface DbData {
  name: string;
  type: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  up: boolean;
  connections?: number;
  maxConnections?: number;
  sizeBytes?: number;
  uptimeSeconds?: number;
  responseTimeMs?: number;
}

function parseDb(snapshot: MonitoringSnapshot): DbData {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(snapshot.value_json);
  } catch {
    // keep empty
  }

  return {
    name: snapshot.resource_name,
    type: snapshot.resource_type,
    status: snapshot.status,
    up: parsed.up === true || parsed.up === 1,
    connections: typeof parsed.connections === 'number' ? parsed.connections : undefined,
    maxConnections: typeof parsed.maxConnections === 'number' ? parsed.maxConnections : undefined,
    sizeBytes: typeof parsed.sizeBytes === 'number' ? parsed.sizeBytes : undefined,
    uptimeSeconds: typeof parsed.uptimeSeconds === 'number' ? parsed.uptimeSeconds : undefined,
    responseTimeMs: typeof parsed.responseTimeMs === 'number' ? parsed.responseTimeMs : undefined,
  };
}

function formatBytes(bytes?: number): string {
  if (bytes == null || bytes < 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatUptime(seconds?: number): string {
  if (seconds == null || seconds < 0) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const DB_TYPE_ICONS: Record<string, string> = {
  postgresql: '🐘',
  postgres: '🐘',
  mysql: '🐬',
  redis: '🔴',
  timescaledb: '⏱',
  mqtt: '📡',
};

function dbIcon(type: string): string {
  const key = type.toLowerCase();
  for (const [k, v] of Object.entries(DB_TYPE_ICONS)) {
    if (key.includes(k)) return v;
  }
  return '💾';
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function DatabasesView() {
  const { data: snapshots, isLoading, isError, refetch } = useDatabases();

  const databases = useMemo(() => {
    if (!snapshots) return [];
    return snapshots.map(parseDb);
  }, [snapshots]);

  const grouped = useMemo(() => {
    const groups: Record<string, DbData[]> = {};
    for (const db of databases) {
      const groupKey = db.type || 'Other';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(db);
    }
    return groups;
  }, [databases]);

  const summary = useMemo(() => {
    const total = databases.length;
    const online = databases.filter((d) => d.up).length;
    const offline = total - online;
    return { total, online, offline };
  }, [databases]);

  if (isLoading) {
    return (
      <div className="p-4">
        <LoadingSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4">
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 px-1 text-xs text-matrix-muted">
        <span>
          <span className="text-gray-200 font-semibold">{summary.total}</span> databases
        </span>
        <span>
          <span className="text-green-400 font-semibold">{summary.online}</span> online
        </span>
        {summary.offline > 0 && (
          <span>
            <span className="text-red-400 font-semibold">{summary.offline}</span> offline
          </span>
        )}
      </div>

      {/* Grouped by resource_type */}
      {Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, dbs]) => (
          <div key={type}>
            <h3 className="text-xs font-medium text-matrix-accent px-1 mb-2 flex items-center gap-1.5">
              <span>{dbIcon(type)}</span>
              {type}
              <span className="text-matrix-muted font-normal">({dbs.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dbs.map((db) => (
                <DbCard key={`${db.type}-${db.name}`} db={db} />
              ))}
            </div>
          </div>
        ))}

      {databases.length === 0 && (
        <p className="text-sm text-matrix-muted text-center py-8">No databases monitored</p>
      )}
    </div>
  );
}

function ConnectionBar({ current, max }: { current: number; max?: number }) {
  const total = max ?? 100;
  const pct = Math.min(100, (current / total) * 100);
  const color = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] text-matrix-muted">
        <span>Connections</span>
        <span>{current}{max ? ` / ${max}` : ''}</span>
      </div>
      <div className="h-1.5 bg-matrix-bg rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DbCard({ db }: { db: DbData }) {
  return (
    <div
      className={`bg-matrix-surface border rounded-md p-3 space-y-2 ${
        !db.up
          ? 'border-red-500/40'
          : db.status === 'warning'
          ? 'border-yellow-500/30'
          : 'border-matrix-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0">{dbIcon(db.type)}</span>
          <span className="text-sm font-medium text-gray-200 truncate">{db.name}</span>
        </div>
        <StatusBadge status={db.status} size="md" showLabel />
      </div>

      {/* Type badge */}
      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-matrix-bg text-matrix-muted border border-matrix-border">
        {db.type}
      </span>

      {/* Connections bar */}
      {db.connections != null && (
        <ConnectionBar current={db.connections} max={db.maxConnections} />
      )}

      {/* Metrics row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {db.sizeBytes != null && (
          <div>
            <span className="text-matrix-muted">Size: </span>
            <span className="text-gray-300">{formatBytes(db.sizeBytes)}</span>
          </div>
        )}
        {db.uptimeSeconds != null && (
          <div>
            <span className="text-matrix-muted">Uptime: </span>
            <span className="text-gray-300">{formatUptime(db.uptimeSeconds)}</span>
          </div>
        )}
        {db.responseTimeMs != null && (
          <div>
            <span className="text-matrix-muted">Latency: </span>
            <span className={db.responseTimeMs > 100 ? 'text-yellow-400' : 'text-gray-300'}>
              {db.responseTimeMs}ms
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
