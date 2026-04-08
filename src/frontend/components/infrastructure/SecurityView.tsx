import React from 'react';
import { useSecurity } from '../../hooks/useMonitoring';
import { StatusBadge } from './shared/StatusBadge';
import { MetricCard } from './shared/MetricCard';
import { ErrorState } from './shared/ErrorState';
import { useUiStore } from '../../stores/ui.store';
import { t } from '../../lib/i18n';
import { safeParseJson } from '../../lib/monitoring-utils';

function daysUntil(dateStr: string): number {
  return (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
}

export function SecurityView() {
  const { language } = useUiStore();
  const { data, isLoading, isError, refetch } = useSecurity();

  if (isLoading) return <p className="text-matrix-muted text-sm p-4">{t('loading', language)}</p>;
  if (isError) return <ErrorState onRetry={refetch} />;
  if (!data || data.length === 0) return <p className="text-matrix-muted text-sm p-4">{t('noData', language)}</p>;

  const certExpiry = data.filter((s) => s.resource_type === 'cert_expiry');
  const vpn = data.filter((s) => s.resource_type === 'vpn' || s.resource_type === 'wireguard');
  const passbolt = data.filter((s) => s.resource_type === 'passbolt');
  const other = data.filter(
    (s) => !['cert_expiry', 'vpn', 'wireguard', 'passbolt'].includes(s.resource_type),
  );

  return (
    <div className="space-y-6">
      {/* Certificate Expiry Warnings */}
      {certExpiry.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">Certificate Expiry</h3>
          <div className="overflow-x-auto rounded border border-matrix-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-matrix-bg">
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Certificate</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Expires</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Days Left</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Status</th>
                </tr>
              </thead>
              <tbody>
                {certExpiry.map((item) => {
                  const v = safeParseJson(item.value_json);
                  const expiry = v.notAfter as string | undefined;
                  const days = expiry ? daysUntil(expiry) : null;
                  const colorClass =
                    days !== null
                      ? days < 7
                        ? 'text-red-400'
                        : days < 14
                          ? 'text-yellow-400'
                          : 'text-green-400'
                      : 'text-gray-400';
                  return (
                    <tr key={item.id} className="border-b border-matrix-border/50 bg-matrix-surface">
                      <td className="px-3 py-2 text-gray-300">{item.resource_name}</td>
                      <td className="px-3 py-2 text-gray-300 text-xs">
                        {expiry ? new Date(expiry).toLocaleDateString() : '—'}
                      </td>
                      <td className={`px-3 py-2 text-xs font-medium ${colorClass}`}>
                        {days !== null ? `${Math.floor(days)}d` : '—'}
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

      {/* VPN / WireGuard */}
      {vpn.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">VPN (WireGuard)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vpn.map((item) => {
              const v = safeParseJson(item.value_json);
              return (
                <MetricCard
                  key={item.id}
                  label={item.resource_name}
                  value={String(v.podStatus ?? v.status ?? item.status)}
                  icon="🔐"
                  status={item.status}
                  subtitle={item.namespace ?? undefined}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Passbolt */}
      {passbolt.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">Password Manager (Passbolt)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {passbolt.map((item) => {
              const v = safeParseJson(item.value_json);
              return (
                <MetricCard
                  key={item.id}
                  label={item.resource_name}
                  value={String(v.status ?? item.status)}
                  icon="🔑"
                  status={item.status}
                  subtitle={v.version ? `v${v.version}` : undefined}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Other security items */}
      {other.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">Other</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {other.map((item) => (
              <MetricCard
                key={item.id}
                label={item.resource_name}
                value={item.resource_type}
                status={item.status}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
