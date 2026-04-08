import React from 'react';
import { useDocker } from '../../hooks/useMonitoring';
import { StatusBadge } from './shared/StatusBadge';
import { MetricCard } from './shared/MetricCard';
import { ErrorState } from './shared/ErrorState';
import { useUiStore } from '../../stores/ui.store';
import { t } from '../../lib/i18n';
import { safeParseJson } from '../../lib/monitoring-utils';

export function DockerView() {
  const { language } = useUiStore();
  const { data, isLoading, isError, refetch } = useDocker();

  if (isLoading) return <p className="text-matrix-muted text-sm p-4">{t('loading', language)}</p>;
  if (isError) return <ErrorState onRetry={refetch} />;
  if (!data || data.length === 0) return <p className="text-matrix-muted text-sm p-4">{t('noData', language)}</p>;

  const registries = data.filter((s) => s.resource_type === 'registry');
  const containers = data.filter((s) => s.resource_type === 'container');
  const other = data.filter((s) => !['registry', 'container'].includes(s.resource_type));

  return (
    <div className="space-y-6">
      {/* Registry Status */}
      {registries.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">Registry</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {registries.map((item) => {
              const v = safeParseJson(item.value_json);
              return (
                <MetricCard
                  key={item.id}
                  label={item.resource_name}
                  value={String(v.imageCount ?? v.repositories ?? item.status)}
                  icon="📦"
                  status={item.status}
                  subtitle={v.url ? String(v.url) : item.namespace ?? undefined}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Containers */}
      {containers.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">Containers</h3>
          <div className="overflow-x-auto rounded border border-matrix-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-matrix-bg">
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Image</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Status</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((item) => {
                  const v = safeParseJson(item.value_json);
                  return (
                    <tr key={item.id} className="border-b border-matrix-border/50 bg-matrix-surface hover:bg-white/[0.03]">
                      <td className="px-3 py-2 text-gray-300">{item.resource_name}</td>
                      <td className="px-3 py-2 text-gray-300 text-xs font-mono truncate max-w-[200px]">
                        {String(v.image ?? '—')}
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={item.status} showLabel /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Other docker resources */}
      {other.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">Resources</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {other.map((item) => {
              return (
                <MetricCard
                  key={item.id}
                  label={item.resource_name}
                  value={item.resource_type}
                  status={item.status}
                  subtitle={item.namespace ?? undefined}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
