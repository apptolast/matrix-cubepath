import React from 'react';
import { useStorage } from '../../hooks/useMonitoring';
import { StatusBadge } from './shared/StatusBadge';
import { ErrorState } from './shared/ErrorState';
import { useUiStore } from '../../stores/ui.store';
import { t } from '../../lib/i18n';
import { safeParseJson } from '../../lib/monitoring-utils';

function UsageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-matrix-bg rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-matrix-muted w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

export function StorageView() {
  const { language } = useUiStore();
  const { data, isLoading, isError, refetch } = useStorage();

  if (isLoading) return <p className="text-matrix-muted text-sm p-4">{t('loading', language)}</p>;
  if (isError) return <ErrorState onRetry={refetch} />;
  if (!data || data.length === 0) return <p className="text-matrix-muted text-sm p-4">{t('noData', language)}</p>;

  const pvcs = data.filter((s) => s.resource_type === 'pvc');
  const longhorn = data.filter((s) => s.resource_type === 'longhorn_volume');

  return (
    <div className="space-y-6">
      {/* PVCs */}
      {pvcs.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">Persistent Volume Claims</h3>
          <div className="overflow-x-auto rounded border border-matrix-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-matrix-bg">
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Namespace</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Capacity</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Phase</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Storage Class</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Usage</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Status</th>
                </tr>
              </thead>
              <tbody>
                {pvcs.map((item) => {
                  const v = safeParseJson(item.value_json);
                  const capacity = String(v.capacity ?? '—');
                  const phase = String(v.phase ?? '—');
                  const storageClass = String(v.storageClassName ?? v.storageClass ?? '—');
                  const usedBytes = typeof v.usedBytes === 'number' ? v.usedBytes : null;
                  const totalBytes = typeof v.capacityBytes === 'number' ? v.capacityBytes : null;
                  return (
                    <tr key={item.id} className="border-b border-matrix-border/50 bg-matrix-surface hover:bg-white/[0.03]">
                      <td className="px-3 py-2 text-gray-300">{item.resource_name}</td>
                      <td className="px-3 py-2 text-gray-300">{item.namespace ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-300 text-xs">{capacity}</td>
                      <td className="px-3 py-2 text-gray-300 text-xs">{phase}</td>
                      <td className="px-3 py-2 text-gray-300 text-xs">{storageClass}</td>
                      <td className="px-3 py-2 w-32">
                        {usedBytes !== null && totalBytes !== null ? (
                          <UsageBar used={usedBytes} total={totalBytes} />
                        ) : (
                          <span className="text-matrix-muted text-xs">—</span>
                        )}
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

      {/* Longhorn Volumes */}
      {longhorn.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">Longhorn Volumes</h3>
          <div className="overflow-x-auto rounded border border-matrix-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-matrix-bg">
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Size</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Replicas</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Status</th>
                </tr>
              </thead>
              <tbody>
                {longhorn.map((item) => {
                  const v = safeParseJson(item.value_json);
                  return (
                    <tr key={item.id} className="border-b border-matrix-border/50 bg-matrix-surface hover:bg-white/[0.03]">
                      <td className="px-3 py-2 text-gray-300">{item.resource_name}</td>
                      <td className="px-3 py-2 text-gray-300 text-xs">{String(v.size ?? '—')}</td>
                      <td className="px-3 py-2 text-gray-300 text-xs">{String(v.numberOfReplicas ?? v.replicas ?? '—')}</td>
                      <td className="px-3 py-2"><StatusBadge status={item.status} showLabel /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
