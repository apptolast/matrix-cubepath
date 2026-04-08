import React, { useState, useMemo } from 'react';
import { useKubernetes, MonitoringSnapshot } from '../../hooks/useMonitoring';
import { StatusBadge } from './shared/StatusBadge';
import { ResourceTable } from './shared/ResourceTable';
import { Skeleton } from '../ui/Skeleton';

type SubTab = 'nodes' | 'pods' | 'deployments' | 'services' | 'namespaces' | 'events';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'nodes', label: 'Nodes' },
  { key: 'pods', label: 'Pods' },
  { key: 'deployments', label: 'Deployments' },
  { key: 'services', label: 'Services' },
  { key: 'namespaces', label: 'Namespaces' },
  { key: 'events', label: 'Events' },
];

function parseValueJson(snapshot: MonitoringSnapshot): Record<string, unknown> {
  try {
    return JSON.parse(snapshot.value_json);
  } catch {
    return {};
  }
}

function enrichSnapshot(snapshot: MonitoringSnapshot) {
  const data = parseValueJson(snapshot);
  return {
    ...data,
    _name: snapshot.resource_name,
    _namespace: snapshot.namespace ?? '',
    _status: snapshot.status,
    _resourceType: snapshot.resource_type,
    _collectedAt: snapshot.collected_at,
  } as Record<string, unknown>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-20" />
        ))}
      </div>
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}

export function KubernetesView() {
  const { data: snapshots, isLoading } = useKubernetes();
  const [activeTab, setActiveTab] = useState<SubTab>('nodes');

  const byType = useMemo(() => {
    if (!snapshots) return { nodes: [], pods: [], deployments: [], services: [], namespaces: [], events: [] };
    const groups: Record<SubTab, Record<string, unknown>[]> = {
      nodes: [],
      pods: [],
      deployments: [],
      services: [],
      namespaces: [],
      events: [],
    };
    for (const snap of snapshots) {
      const rt = snap.resource_type.toLowerCase();
      const enriched = enrichSnapshot(snap);
      if (rt.includes('node')) groups.nodes.push(enriched);
      else if (rt.includes('pod')) groups.pods.push(enriched);
      else if (rt.includes('deploy')) groups.deployments.push(enriched);
      else if (rt.includes('service') || rt === 'svc') groups.services.push(enriched);
      else if (rt.includes('namespace') || rt === 'ns') groups.namespaces.push(enriched);
      else if (rt.includes('event')) groups.events.push(enriched);
    }
    return groups;
  }, [snapshots]);

  const summary = useMemo(() => ({
    nodes: byType.nodes.length,
    pods: byType.pods.length,
    deployments: byType.deployments.length,
  }), [byType]);

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
          <span className="text-gray-200 font-semibold">{summary.nodes}</span> nodes
        </span>
        <span>
          <span className="text-gray-200 font-semibold">{summary.pods}</span> pods
        </span>
        <span>
          <span className="text-gray-200 font-semibold">{summary.deployments}</span> deployments
        </span>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex flex-wrap gap-1 border-b border-matrix-border pb-px">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
              activeTab === tab.key
                ? 'bg-matrix-surface text-matrix-accent border border-matrix-border border-b-matrix-surface -mb-px'
                : 'text-matrix-muted hover:text-gray-300'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] text-matrix-muted">
              ({byType[tab.key].length})
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[200px]">
        {activeTab === 'nodes' && <NodesTable data={byType.nodes} />}
        {activeTab === 'pods' && <PodsTable data={byType.pods} />}
        {activeTab === 'deployments' && <DeploymentsTable data={byType.deployments} />}
        {activeTab === 'services' && <ServicesTable data={byType.services} />}
        {activeTab === 'namespaces' && <NamespacesTable data={byType.namespaces} />}
        {activeTab === 'events' && <EventsList data={byType.events} />}
      </div>
    </div>
  );
}

/* ── Sub-tab table components ─────────────────────────────────────── */

function NodesTable({ data }: { data: Record<string, unknown>[] }) {
  const columns = [
    { key: '_name', label: 'Name', sortable: true },
    {
      key: '_status',
      label: 'Status',
      render: (item: Record<string, unknown>) => (
        <StatusBadge status={item._status as 'healthy' | 'warning' | 'critical' | 'unknown'} size="md" showLabel />
      ),
    },
    {
      key: 'cpuCapacity',
      label: 'CPU Capacity',
      render: (item: Record<string, unknown>) => {
        const capacity = item.capacity as Record<string, unknown> | undefined;
        return (
          <span className="text-gray-300">{String(capacity?.cpu ?? item.cpuCapacity ?? '-')}</span>
        );
      },
    },
    {
      key: 'memoryCapacity',
      label: 'Memory Capacity',
      render: (item: Record<string, unknown>) => {
        const capacity = item.capacity as Record<string, unknown> | undefined;
        return (
          <span className="text-gray-300">{String(capacity?.memory ?? item.memoryCapacity ?? '-')}</span>
        );
      },
    },
    {
      key: 'conditions',
      label: 'Conditions',
      render: (item: Record<string, unknown>) => {
        const conds = item.conditions;
        if (Array.isArray(conds)) {
          return (
            <span className="text-xs text-matrix-muted">
              {conds.map((c: { type?: string }) => c.type).filter(Boolean).join(', ') || '-'}
            </span>
          );
        }
        return <span className="text-matrix-muted">-</span>;
      },
    },
  ];

  return <ResourceTable columns={columns} data={data} emptyMessage="No nodes found" />;
}

function PodsTable({ data }: { data: Record<string, unknown>[] }) {
  const columns = [
    { key: '_name', label: 'Name', sortable: true },
    { key: '_namespace', label: 'Namespace', sortable: true },
    {
      key: 'phase',
      label: 'Phase',
      sortable: true,
      render: (item: Record<string, unknown>) => {
        const phase = String(item.phase ?? '-');
        const color = phase === 'Running' ? 'text-green-400' : phase === 'Pending' ? 'text-yellow-400' : 'text-gray-300';
        return <span className={color}>{phase}</span>;
      },
    },
    {
      key: 'restarts',
      label: 'Restarts',
      sortable: true,
      render: (item: Record<string, unknown>) => {
        const restarts = Number(item.restarts ?? item.restartCount ?? 0);
        const color = restarts > 5 ? 'text-red-400' : restarts > 0 ? 'text-yellow-400' : 'text-gray-300';
        return <span className={color}>{restarts}</span>;
      },
    },
    {
      key: '_status',
      label: 'Status',
      render: (item: Record<string, unknown>) => (
        <StatusBadge status={item._status as 'healthy' | 'warning' | 'critical' | 'unknown'} size="md" showLabel />
      ),
    },
  ];

  return <ResourceTable columns={columns} data={data} searchable searchPlaceholder="Search pods..." emptyMessage="No pods found" />;
}

function DeploymentsTable({ data }: { data: Record<string, unknown>[] }) {
  const columns = [
    { key: '_name', label: 'Name', sortable: true },
    { key: '_namespace', label: 'Namespace', sortable: true },
    {
      key: 'ready',
      label: 'Ready / Desired',
      render: (item: Record<string, unknown>) => {
        const ready = Number(item.readyReplicas ?? item.ready ?? 0);
        const desired = Number(item.desiredReplicas ?? item.desired ?? item.replicas ?? 0);
        const isUnhealthy = ready < desired;
        return (
          <span className={isUnhealthy ? 'text-red-400 font-semibold' : 'text-gray-300'}>
            {ready} / {desired}
          </span>
        );
      },
    },
    {
      key: '_status',
      label: 'Status',
      render: (item: Record<string, unknown>) => (
        <StatusBadge status={item._status as 'healthy' | 'warning' | 'critical' | 'unknown'} size="md" showLabel />
      ),
    },
  ];

  return <ResourceTable columns={columns} data={data} emptyMessage="No deployments found" />;
}

function ServicesTable({ data }: { data: Record<string, unknown>[] }) {
  const columns = [
    { key: '_name', label: 'Name', sortable: true },
    { key: '_namespace', label: 'Namespace', sortable: true },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (item: Record<string, unknown>) => (
        <span className="text-gray-300">{String(item.type ?? item.serviceType ?? '-')}</span>
      ),
    },
    {
      key: 'clusterIP',
      label: 'ClusterIP',
      render: (item: Record<string, unknown>) => (
        <span className="font-mono text-xs text-gray-400">{String(item.clusterIP ?? item.cluster_ip ?? '-')}</span>
      ),
    },
    {
      key: 'ports',
      label: 'Ports',
      render: (item: Record<string, unknown>) => {
        const ports = item.ports;
        if (Array.isArray(ports)) {
          return (
            <span className="text-xs text-matrix-muted">
              {ports.map((p: { port?: number; protocol?: string }) => `${p.port ?? ''}/${p.protocol ?? 'TCP'}`).join(', ')}
            </span>
          );
        }
        return <span className="text-matrix-muted">{String(ports ?? '-')}</span>;
      },
    },
  ];

  return <ResourceTable columns={columns} data={data} emptyMessage="No services found" />;
}

function NamespacesTable({ data }: { data: Record<string, unknown>[] }) {
  const columns = [
    { key: '_name', label: 'Name', sortable: true },
    {
      key: 'phase',
      label: 'Phase',
      render: (item: Record<string, unknown>) => {
        const phase = String(item.phase ?? 'Active');
        const color = phase === 'Active' ? 'text-green-400' : 'text-yellow-400';
        return <span className={color}>{phase}</span>;
      },
    },
    {
      key: '_status',
      label: 'Status',
      render: (item: Record<string, unknown>) => (
        <StatusBadge status={item._status as 'healthy' | 'warning' | 'critical' | 'unknown'} size="md" showLabel />
      ),
    },
  ];

  return <ResourceTable columns={columns} data={data} emptyMessage="No namespaces found" />;
}

function EventsList({ data }: { data: Record<string, unknown>[] }) {
  const warningEvents = useMemo(
    () => data.filter((e) => {
      const eventType = String(e.type ?? e.eventType ?? '').toLowerCase();
      return eventType === 'warning' || e._status === 'warning' || e._status === 'critical';
    }),
    [data],
  );

  if (warningEvents.length === 0 && data.length === 0) {
    return <p className="text-sm text-matrix-muted px-1 py-4">No events found</p>;
  }

  const displayEvents = warningEvents.length > 0 ? warningEvents : data;

  return (
    <div className="space-y-2">
      {warningEvents.length > 0 && (
        <p className="text-xs text-yellow-400 px-1">{warningEvents.length} warning event(s)</p>
      )}
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {displayEvents.map((event, i) => (
          <div
            key={i}
            className="bg-matrix-surface border border-yellow-500/30 rounded px-3 py-2 text-xs space-y-0.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-yellow-400">
                {String(event.reason ?? 'Unknown')}
              </span>
              <span className="text-matrix-muted shrink-0">
                {String(event._name ?? '')}
              </span>
            </div>
            <p className="text-gray-400 leading-relaxed">
              {String(event.message ?? event.msg ?? '-')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
