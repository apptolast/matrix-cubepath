import React from 'react';
import { useIoT } from '../../hooks/useMonitoring';
import { StatusBadge } from './shared/StatusBadge';
import { MetricCard } from './shared/MetricCard';
import { useUiStore } from '../../stores/ui.store';
import { t } from '../../lib/i18n';

function parseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function IoTView() {
  const { language } = useUiStore();
  const { data, isLoading } = useIoT();

  if (isLoading) return <p className="text-matrix-muted text-sm p-4">{t('loading', language)}</p>;
  if (!data || data.length === 0) return <p className="text-matrix-muted text-sm p-4">{t('noData', language)}</p>;

  const emqx = data.filter((s) => s.resource_type === 'emqx' || s.resource_type === 'mqtt_broker');
  const other = data.filter((s) => !['emqx', 'mqtt_broker'].includes(s.resource_type));

  return (
    <div className="space-y-6">
      {/* EMQX Broker */}
      {emqx.map((item) => {
        const v = parseJson(item.value_json);
        const connectedClients = v.connectedClients ?? v.connected_clients ?? '—';
        const maxConnections = v.maxConnections ?? v.max_connections ?? '—';
        const subscriptions = v.subscriptionCount ?? v.subscription_count ?? '—';
        const msgIn = v.messageRateIn ?? v.message_rate_in ?? '—';
        const msgOut = v.messageRateOut ?? v.message_rate_out ?? '—';
        const topics = v.topicCount ?? v.topic_count ?? '—';
        const retained = v.retainedMessages ?? v.retained_messages ?? '—';
        const dataSource = v.dataSource ?? v.data_source ?? '';

        return (
          <section key={item.id}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-matrix-accent">EMQX Broker</h3>
              <StatusBadge status={item.status} showLabel />
              {dataSource && (
                <span className="text-[10px] text-matrix-muted bg-matrix-bg px-1.5 py-0.5 rounded">
                  {String(dataSource)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <MetricCard label="Connected Clients" value={String(connectedClients)} icon="📡" />
              <MetricCard label="Max Connections" value={String(maxConnections)} icon="🔗" />
              <MetricCard label="Subscriptions" value={String(subscriptions)} icon="📬" />
              <MetricCard label="Topics" value={String(topics)} icon="📋" />
              <MetricCard label="Msg Rate In" value={`${msgIn}/s`} icon="📥" />
              <MetricCard label="Msg Rate Out" value={`${msgOut}/s`} icon="📤" />
              <MetricCard label="Retained Messages" value={String(retained)} icon="💾" />
            </div>
          </section>
        );
      })}

      {/* Other IoT resources */}
      {other.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-matrix-accent mb-2">Other IoT Resources</h3>
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
