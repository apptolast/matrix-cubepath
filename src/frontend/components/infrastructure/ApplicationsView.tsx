import React, { useState, useMemo } from 'react';
import { useApplications, MonitoringSnapshot } from '../../hooks/useMonitoring';
import { StatusBadge } from './shared/StatusBadge';
import { Skeleton } from '../ui/Skeleton';

interface AppData {
  name: string;
  namespace: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  responseTimeMs?: number;
  httpStatus?: number;
  url?: string;
  error?: string;
}

function parseApp(snapshot: MonitoringSnapshot): AppData {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(snapshot.value_json);
  } catch {
    // keep empty
  }

  return {
    name: snapshot.resource_name,
    namespace: snapshot.namespace ?? 'default',
    status: (parsed.status as AppData['status']) ?? snapshot.status,
    responseTimeMs: typeof parsed.responseTimeMs === 'number' ? parsed.responseTimeMs : undefined,
    httpStatus: typeof parsed.httpStatus === 'number' ? parsed.httpStatus : undefined,
    url: typeof parsed.url === 'string' ? parsed.url : undefined,
    error: typeof parsed.error === 'string' ? parsed.error : undefined,
  };
}

function responseTimeColor(ms?: number): string {
  if (ms == null) return 'text-matrix-muted';
  if (ms < 1000) return 'text-green-400';
  if (ms <= 5000) return 'text-yellow-400';
  return 'text-red-400';
}

function formatResponseTime(ms?: number): string {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function ApplicationsView() {
  const { data: snapshots, isLoading } = useApplications();
  const [expandedNs, setExpandedNs] = useState<Set<string>>(new Set());

  const apps = useMemo(() => {
    if (!snapshots) return [];
    return snapshots.map(parseApp);
  }, [snapshots]);

  const grouped = useMemo(() => {
    const groups: Record<string, AppData[]> = {};
    for (const app of apps) {
      if (!groups[app.namespace]) groups[app.namespace] = [];
      groups[app.namespace].push(app);
    }
    return groups;
  }, [apps]);

  const summary = useMemo(() => {
    const total = apps.length;
    const healthy = apps.filter((a) => a.status === 'healthy').length;
    const issues = total - healthy;
    return { total, healthy, issues };
  }, [apps]);

  // Auto-expand all namespaces on initial load
  useMemo(() => {
    if (expandedNs.size === 0 && Object.keys(grouped).length > 0) {
      setExpandedNs(new Set(Object.keys(grouped)));
    }
  }, [grouped]);

  const toggleNs = (ns: string) => {
    setExpandedNs((prev) => {
      const next = new Set(prev);
      if (next.has(ns)) next.delete(ns);
      else next.add(ns);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 px-1 text-xs text-matrix-muted">
        <span>
          <span className="text-gray-200 font-semibold">{summary.total}</span> apps monitored
        </span>
        <span>
          <span className="text-green-400 font-semibold">{summary.healthy}</span> healthy
        </span>
        {summary.issues > 0 && (
          <span>
            <span className="text-red-400 font-semibold">{summary.issues}</span> issues
          </span>
        )}
      </div>

      {/* Grouped by namespace */}
      {Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([ns, nsApps]) => (
          <div key={ns} className="border border-matrix-border rounded-md overflow-hidden">
            {/* Namespace header (collapsible) */}
            <button
              onClick={() => toggleNs(ns)}
              className="w-full flex items-center justify-between px-3 py-2 bg-matrix-bg hover:bg-white/[0.02] transition-colors text-left"
            >
              <span className="text-xs font-medium text-matrix-accent">
                {expandedNs.has(ns) ? '▾' : '▸'} {ns}
              </span>
              <span className="text-[10px] text-matrix-muted">{nsApps.length} app(s)</span>
            </button>

            {/* Cards grid */}
            {expandedNs.has(ns) && (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {nsApps.map((app) => (
                  <AppCard key={`${app.namespace}-${app.name}`} app={app} />
                ))}
              </div>
            )}
          </div>
        ))}

      {apps.length === 0 && (
        <p className="text-sm text-matrix-muted text-center py-8">No applications monitored</p>
      )}
    </div>
  );
}

function AppCard({ app }: { app: AppData }) {
  return (
    <div
      className={`bg-matrix-surface border rounded-md p-3 space-y-2 transition-colors hover:bg-white/[0.02] cursor-default ${
        app.status === 'critical'
          ? 'border-red-500/40'
          : app.status === 'warning'
          ? 'border-yellow-500/30'
          : 'border-matrix-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-200 truncate">{app.name}</span>
        <StatusBadge status={app.status} size="md" showLabel />
      </div>

      {/* Metrics */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-matrix-muted">Response: </span>
          <span className={responseTimeColor(app.responseTimeMs)}>
            {formatResponseTime(app.responseTimeMs)}
          </span>
        </div>
        {app.httpStatus != null && (
          <div>
            <span className="text-matrix-muted">HTTP: </span>
            <span className={app.httpStatus >= 400 ? 'text-red-400' : 'text-green-400'}>
              {app.httpStatus}
            </span>
          </div>
        )}
      </div>

      {/* URL */}
      {app.url && (
        <p className="text-[10px] text-matrix-muted truncate" title={app.url}>
          {app.url}
        </p>
      )}

      {/* Error */}
      {app.error && (
        <p className="text-[10px] text-red-400 truncate" title={app.error}>
          {app.error}
        </p>
      )}
    </div>
  );
}
