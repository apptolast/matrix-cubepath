import React from 'react';
import { useBackups } from '../../hooks/useMonitoring';
import { StatusBadge } from './shared/StatusBadge';
import { useUiStore } from '../../stores/ui.store';
import { t } from '../../lib/i18n';

function parseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function relativeTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
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

function backupRowStatus(v: Record<string, unknown>): 'healthy' | 'warning' | 'critical' {
  const lastSuccess = v.lastSuccessfulTime as string | undefined;
  const lastFailure = v.lastFailedTime as string | undefined;
  if (lastFailure && lastSuccess) {
    if (new Date(lastFailure).getTime() > new Date(lastSuccess).getTime()) return 'critical';
  }
  if (!lastSuccess) return 'warning';
  const hoursSinceSuccess = (Date.now() - new Date(lastSuccess).getTime()) / (1000 * 60 * 60);
  if (hoursSinceSuccess > 48) return 'warning';
  return 'healthy';
}

export function BackupsView() {
  const { language } = useUiStore();
  const { data, isLoading } = useBackups();

  if (isLoading) return <p className="text-matrix-muted text-sm p-4">{t('loading', language)}</p>;
  if (!data || data.length === 0) return <p className="text-matrix-muted text-sm p-4">{t('noData', language)}</p>;

  const cronjobs = data.filter((s) => s.resource_type === 'cronjob');
  const other = data.filter((s) => s.resource_type !== 'cronjob');

  return (
    <div className="space-y-6">
      {/* CronJobs */}
      {cronjobs.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">Backup CronJobs</h3>
          <div className="overflow-x-auto rounded border border-matrix-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-matrix-bg">
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Schedule</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Last Success</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Last Failure</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Status</th>
                </tr>
              </thead>
              <tbody>
                {cronjobs.map((item) => {
                  const v = parseJson(item.value_json);
                  const schedule = String(v.schedule ?? '—');
                  const lastSuccess = v.lastSuccessfulTime as string | undefined;
                  const lastFailure = v.lastFailedTime as string | undefined;
                  const rowStatus = backupRowStatus(v);
                  return (
                    <tr key={item.id} className="border-b border-matrix-border/50 bg-matrix-surface hover:bg-white/[0.03]">
                      <td className="px-3 py-2 text-gray-300">{item.resource_name}</td>
                      <td className="px-3 py-2 text-gray-300 text-xs font-mono">{schedule}</td>
                      <td className={`px-3 py-2 text-xs ${rowStatus === 'healthy' ? 'text-green-400' : 'text-gray-400'}`}>
                        {relativeTime(lastSuccess)}
                      </td>
                      <td className={`px-3 py-2 text-xs ${lastFailure ? 'text-red-400' : 'text-gray-400'}`}>
                        {relativeTime(lastFailure)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={rowStatus} showLabel />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Other backup items */}
      {other.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">Other Backups</h3>
          <div className="overflow-x-auto rounded border border-matrix-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-matrix-bg">
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Type</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Collected</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Status</th>
                </tr>
              </thead>
              <tbody>
                {other.map((item) => (
                  <tr key={item.id} className="border-b border-matrix-border/50 bg-matrix-surface">
                    <td className="px-3 py-2 text-gray-300">{item.resource_name}</td>
                    <td className="px-3 py-2 text-gray-300 text-xs">{item.resource_type}</td>
                    <td className="px-3 py-2 text-gray-300 text-xs">{relativeTime(item.collected_at)}</td>
                    <td className="px-3 py-2"><StatusBadge status={item.status} showLabel /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
