import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useMonitoringStore, MonitoringSubView } from '../../stores/monitoring.store';
import { useRefreshMonitoring, useMonitoringDashboard } from '../../hooks/useMonitoring';
import { useUiStore } from '../../stores/ui.store';
import { t, LangKey } from '../../lib/i18n';
import { timeAgo } from '../../lib/monitoring-utils';
import { InfraDashboard } from './InfraDashboard';
import { KubernetesView } from './KubernetesView';
import { DatabasesView } from './DatabasesView';
import { ApplicationsView } from './ApplicationsView';
import { NetworkView } from './NetworkView';
import { StorageView } from './StorageView';
import { DockerView } from './DockerView';
import { SecurityView } from './SecurityView';
import { BackupsView } from './BackupsView';
import { IoTView } from './IoTView';
import { AlertsView } from './AlertsView';

// ── Error Boundary ────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class InfraErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('InfrastructureView error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-red-400 text-sm mb-2">Something went wrong</div>
          <p className="text-xs text-matrix-muted mb-4 max-w-md">
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs px-3 py-1.5 rounded border border-matrix-border text-matrix-accent hover:bg-matrix-surface transition-colors"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ── Stale data indicator ──────────────────────────────────────────────────

function LastUpdated() {
  const { dataUpdatedAt } = useMonitoringDashboard();

  if (!dataUpdatedAt) return null;

  const ageMs = Date.now() - dataUpdatedAt;
  const isStale = ageMs > 5 * 60 * 1000; // > 5 min

  return (
    <span
      className={`text-[10px] ${isStale ? 'text-yellow-400' : 'text-matrix-muted'}`}
      title={new Date(dataUpdatedAt).toISOString()}
    >
      {timeAgo(new Date(dataUpdatedAt).toISOString())}
    </span>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────

const tabs: { key: MonitoringSubView; labelKey: LangKey }[] = [
  { key: 'dashboard', labelKey: 'dashboard' },
  { key: 'kubernetes', labelKey: 'kubernetes' },
  { key: 'databases', labelKey: 'databases' },
  { key: 'applications', labelKey: 'applications' },
  { key: 'network', labelKey: 'network' },
  { key: 'storage', labelKey: 'storage' },
  { key: 'docker', labelKey: 'docker' },
  { key: 'security', labelKey: 'security' },
  { key: 'backups', labelKey: 'backups' },
  { key: 'iot', labelKey: 'iot' },
  { key: 'alerts', labelKey: 'alerts' },
];

export function InfrastructureView() {
  const { activeSubView, setActiveSubView } = useMonitoringStore();
  const refreshMonitoring = useRefreshMonitoring();
  const { language } = useUiStore();

  const renderSubView = () => {
    switch (activeSubView) {
      case 'dashboard':
        return <InfraDashboard />;
      case 'kubernetes':
        return <KubernetesView />;
      case 'databases':
        return <DatabasesView />;
      case 'applications':
        return <ApplicationsView />;
      case 'network':
        return <NetworkView />;
      case 'storage':
        return <StorageView />;
      case 'docker':
        return <DockerView />;
      case 'security':
        return <SecurityView />;
      case 'backups':
        return <BackupsView />;
      case 'iot':
        return <IoTView />;
      case 'alerts':
        return <AlertsView />;
      default:
        return <InfraDashboard />;
    }
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Top bar with tabs + refresh */}
      <div className="flex items-center gap-2 border-b border-matrix-border pb-2 mb-4">
        <div className="flex-1 flex items-center gap-1 overflow-x-auto pr-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSubView(tab.key)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded transition-colors ${
                activeSubView === tab.key
                  ? 'bg-matrix-accent/10 text-matrix-accent font-medium'
                  : 'text-matrix-muted hover:text-gray-300 hover:bg-white/[0.02]'
              }`}
            >
              {t(tab.labelKey, language)}
            </button>
          ))}
        </div>

        <LastUpdated />

        <button
          onClick={() => refreshMonitoring.mutate()}
          disabled={refreshMonitoring.isPending}
          className="shrink-0 text-xs px-3 py-1.5 bg-matrix-accent/10 text-matrix-accent rounded hover:bg-matrix-accent/20 transition-colors disabled:opacity-50"
          title={t('refresh' as LangKey, language)}
        >
          {refreshMonitoring.isPending ? '...' : t('refresh' as LangKey, language)}
        </button>
      </div>

      {/* Active sub-view with error boundary */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <InfraErrorBoundary>{renderSubView()}</InfraErrorBoundary>
      </div>
    </div>
  );
}
