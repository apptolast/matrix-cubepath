import React from 'react';
import { useMonitoringDashboard } from '../../hooks/useMonitoring';
import { useMonitoringStore } from '../../stores/monitoring.store';
import { useUiStore } from '../../stores/ui.store';
import { t, LangKey } from '../../lib/i18n';
import { MetricCard } from './shared/MetricCard';
import { StatusBadge } from './shared/StatusBadge';
import { Skeleton } from '../ui/Skeleton';

const categoryIcons: Record<string, string> = {
  kubernetes: '\u2388',
  databases: '\u26C1',
  applications: '\u25A3',
  network: '\u26A1',
  storage: '\u26C3',
  docker: '\u2B21',
  security: '\u26E8',
  backups: '\u21BB',
  iot: '\u25C9',
};

const categoryToSubView: Record<string, string> = {
  kubernetes: 'kubernetes',
  databases: 'databases',
  applications: 'applications',
  network: 'network',
  storage: 'storage',
  docker: 'docker',
  security: 'security',
  backups: 'backups',
  iot: 'iot',
};

function overallStatus(healthy: number, warning: number, critical: number) {
  if (critical > 0) return 'critical' as const;
  if (warning > 0) return 'warning' as const;
  if (healthy > 0) return 'healthy' as const;
  return 'unknown' as const;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function severityColor(severity: string) {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/15 text-red-400';
    case 'warning':
      return 'bg-yellow-500/15 text-yellow-400';
    default:
      return 'bg-blue-500/15 text-blue-400';
  }
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-matrix-surface border border-matrix-border rounded-md p-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="w-14 h-4 rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-6 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export function InfraDashboard() {
  const { data, isLoading } = useMonitoringDashboard();
  const { setActiveSubView } = useMonitoringStore();
  const { language } = useUiStore();

  if (isLoading) return <DashboardSkeleton />;

  if (!data || !data.enabled) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-matrix-muted">{t('monitoringDisabled' as LangKey, language)}</p>
      </div>
    );
  }

  const { summary, activeAlerts, lastUpdate } = data;

  const totals = summary.reduce(
    (acc, cat) => ({
      healthy: acc.healthy + cat.healthy,
      warning: acc.warning + cat.warning,
      critical: acc.critical + cat.critical,
    }),
    { healthy: 0, warning: 0, critical: 0 },
  );

  return (
    <div className="space-y-4">
      {/* Overall health bar */}
      <div className="bg-matrix-surface border border-matrix-border rounded-md p-3 flex flex-wrap items-center gap-4">
        <StatusBadge
          status={overallStatus(totals.healthy, totals.warning, totals.critical)}
          size="lg"
        />
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-green-400">
            {totals.healthy} {t('healthy' as LangKey, language)}
          </span>
          <span className="text-yellow-400">
            {totals.warning} {t('warning' as LangKey, language)}
          </span>
          <span className="text-red-400">
            {totals.critical} {t('critical' as LangKey, language)}
          </span>
        </div>
        {lastUpdate && (
          <span className="text-[10px] text-matrix-muted ml-auto">
            {t('lastChecked' as LangKey, language)}: {timeAgo(lastUpdate)}
          </span>
        )}
      </div>

      {/* Category cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {summary.map((cat) => {
          const subView = categoryToSubView[cat.category];
          const catKey = cat.category as LangKey;
          const catLabel = t(catKey, language);

          return (
            <MetricCard
              key={cat.category}
              label={catLabel}
              value={cat.total}
              icon={categoryIcons[cat.category] || '\u25CB'}
              status={overallStatus(cat.healthy, cat.warning, cat.critical)}
              subtitle={`${cat.healthy}h / ${cat.warning}w / ${cat.critical}c`}
              onClick={
                subView
                  ? () =>
                      setActiveSubView(
                        subView as Parameters<typeof setActiveSubView>[0],
                      )
                  : undefined
              }
            />
          );
        })}
      </div>

      {/* Active alerts */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">
          {t('activeAlerts' as LangKey, language)} ({activeAlerts.length})
        </h3>
        {activeAlerts.length === 0 ? (
          <div className="bg-matrix-surface border border-matrix-border rounded-md p-4 text-center">
            <p className="text-xs text-matrix-muted">{t('allClear' as LangKey, language)}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-matrix-surface border border-matrix-border rounded-md px-3 py-2 flex items-center gap-3"
              >
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${severityColor(alert.severity)}`}
                >
                  {alert.severity}
                </span>
                <span className="text-xs text-gray-400 shrink-0">{alert.resource_name}</span>
                <span className="text-xs text-gray-300 flex-1 truncate">{alert.message}</span>
                <span className="text-[10px] text-matrix-muted shrink-0">
                  {timeAgo(alert.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
