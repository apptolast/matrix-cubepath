import React from 'react';
import { useNetwork } from '../../hooks/useMonitoring';
import { StatusBadge } from './shared/StatusBadge';
import { ErrorState } from './shared/ErrorState';
import { useUiStore } from '../../stores/ui.store';
import { t } from '../../lib/i18n';
import { safeParseJson } from '../../lib/monitoring-utils';

function certExpiryStatus(expiryDate: string): 'healthy' | 'warning' | 'critical' {
  const diff = new Date(expiryDate).getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 7) return 'critical';
  if (days < 14) return 'warning';
  return 'healthy';
}

function certExpiryColor(expiryDate: string): string {
  const diff = new Date(expiryDate).getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 7) return 'text-red-400';
  if (days < 14) return 'text-yellow-400';
  return 'text-green-400';
}

export function NetworkView() {
  const { language } = useUiStore();
  const { data, isLoading, isError, refetch } = useNetwork();

  if (isLoading) return <p className="text-matrix-muted text-sm p-4">{t('loading', language)}</p>;
  if (isError) return <ErrorState onRetry={refetch} />;
  if (!data || data.length === 0) return <p className="text-matrix-muted text-sm p-4">{t('noData', language)}</p>;

  const ingress = data.filter((s) => s.resource_type === 'ingress_route');
  const certs = data.filter((s) => s.resource_type === 'certificate');
  const dns = data.filter((s) => s.resource_type === 'dns_check');

  return (
    <div className="space-y-6">
      {/* Ingress Routes */}
      {ingress.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">Ingress Routes</h3>
          <div className="overflow-x-auto rounded border border-matrix-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-matrix-bg">
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Namespace</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Hosts</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Status</th>
                </tr>
              </thead>
              <tbody>
                {ingress.map((item) => {
                  const v = safeParseJson(item.value_json);
                  const hosts = Array.isArray(v.hosts) ? (v.hosts as string[]).join(', ') : String(v.hosts ?? '—');
                  return (
                    <tr key={item.id} className="border-b border-matrix-border/50 bg-matrix-surface hover:bg-white/[0.03]">
                      <td className="px-3 py-2 text-gray-300">{item.resource_name}</td>
                      <td className="px-3 py-2 text-gray-300">{item.namespace ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-300 text-xs font-mono">{hosts}</td>
                      <td className="px-3 py-2"><StatusBadge status={item.status} showLabel /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Certificates */}
      {certs.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">Certificates</h3>
          <div className="overflow-x-auto rounded border border-matrix-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-matrix-bg">
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">DNS Names</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Expiry</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Status</th>
                </tr>
              </thead>
              <tbody>
                {certs.map((item) => {
                  const v = safeParseJson(item.value_json);
                  const dnsNames = Array.isArray(v.dnsNames) ? (v.dnsNames as string[]).join(', ') : String(v.dnsNames ?? '—');
                  const expiry = v.notAfter as string | undefined;
                  return (
                    <tr key={item.id} className="border-b border-matrix-border/50 bg-matrix-surface hover:bg-white/[0.03]">
                      <td className="px-3 py-2 text-gray-300">{item.resource_name}</td>
                      <td className="px-3 py-2 text-gray-300 text-xs font-mono">{dnsNames}</td>
                      <td className={`px-3 py-2 text-xs ${expiry ? certExpiryColor(expiry) : 'text-gray-400'}`}>
                        {expiry ? new Date(expiry).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={expiry ? certExpiryStatus(expiry) : item.status} showLabel />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* DNS Checks */}
      {dns.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">DNS Checks</h3>
          <div className="overflow-x-auto rounded border border-matrix-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-matrix-bg">
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Domain</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Resolved</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-matrix-muted border-b border-matrix-border">Status</th>
                </tr>
              </thead>
              <tbody>
                {dns.map((item) => {
                  const v = safeParseJson(item.value_json);
                  return (
                    <tr key={item.id} className="border-b border-matrix-border/50 bg-matrix-surface hover:bg-white/[0.03]">
                      <td className="px-3 py-2 text-gray-300 font-mono text-xs">{item.resource_name}</td>
                      <td className="px-3 py-2 text-gray-300 text-xs">{v.resolved ? 'Yes' : 'No'}</td>
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
