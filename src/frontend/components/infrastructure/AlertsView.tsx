import React, { useState } from 'react';
import { useMonitoringAlerts, useAcknowledgeAlert } from '../../hooks/useMonitoring';
import { useUiStore } from '../../stores/ui.store';
import { t } from '../../lib/i18n';

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  warning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

function relativeTime(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  if (ms < 0) return 'in future';
  const mins = Math.floor(ms / (1000 * 60));
  if (mins < 1) return 'just now';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return `${mins}m ago`;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function AlertsView() {
  const { language } = useUiStore();
  const { data, isLoading } = useMonitoringAlerts();
  const ackMutation = useAcknowledgeAlert();
  const [filter, setFilter] = useState<SeverityFilter>('all');

  if (isLoading) return <p className="text-matrix-muted text-sm p-4">{t('loading', language)}</p>;
  if (!data || data.length === 0) return <p className="text-matrix-muted text-sm p-4">{t('noData', language)}</p>;

  const filtered = filter === 'all' ? data : data.filter((a) => a.severity === filter);

  const sorted = [...filtered].sort((a, b) => {
    const so = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
    if (so !== 0) return so;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const filters: SeverityFilter[] = ['all', 'critical', 'warning', 'info'];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-md border transition-colors ${
              filter === f
                ? 'bg-matrix-accent/15 text-matrix-accent border-matrix-accent/40'
                : 'bg-matrix-surface text-matrix-muted border-matrix-border hover:text-gray-300'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1 opacity-70">
                ({data.filter((a) => a.severity === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {sorted.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-md border p-3 ${severityColors[alert.severity] ?? 'bg-matrix-surface border-matrix-border'} ${
              alert.resolved_at ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    alert.severity === 'critical'
                      ? 'bg-red-500/20 text-red-400'
                      : alert.severity === 'warning'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {alert.severity}
                  </span>
                  <span className="text-xs text-gray-300 font-medium truncate">
                    {alert.resource_name}
                  </span>
                  <span className="text-[10px] text-matrix-muted bg-matrix-bg/50 px-1.5 py-0.5 rounded">
                    {alert.category}
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{alert.message}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] text-matrix-muted">{relativeTime(alert.created_at)}</span>
                  {alert.acknowledged ? (
                    <span className="text-[10px] text-green-400/70">acknowledged</span>
                  ) : null}
                  {alert.resolved_at && (
                    <span className="text-[10px] text-matrix-muted">
                      resolved {relativeTime(alert.resolved_at)}
                    </span>
                  )}
                </div>
              </div>
              {!alert.acknowledged && !alert.resolved_at && (
                <button
                  onClick={() => ackMutation.mutate(alert.id)}
                  disabled={ackMutation.isPending}
                  className="shrink-0 text-[10px] px-2 py-1 rounded border border-matrix-accent/40 text-matrix-accent hover:bg-matrix-accent/10 transition-colors disabled:opacity-50"
                >
                  {t('acknowledge', language)}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {sorted.length === 0 && (
        <p className="text-matrix-muted text-sm text-center py-8">{t('allClear', language)}</p>
      )}
    </div>
  );
}
