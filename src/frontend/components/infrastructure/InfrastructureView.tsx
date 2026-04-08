import React from 'react';
import { useMonitoringStore, MonitoringSubView } from '../../stores/monitoring.store';
import { useRefreshMonitoring } from '../../hooks/useMonitoring';
import { useUiStore } from '../../stores/ui.store';
import { t, LangKey } from '../../lib/i18n';
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

        <button
          onClick={() => refreshMonitoring.mutate()}
          disabled={refreshMonitoring.isPending}
          className="shrink-0 text-xs px-3 py-1.5 bg-matrix-accent/10 text-matrix-accent rounded hover:bg-matrix-accent/20 transition-colors disabled:opacity-50"
          title={t('refresh' as LangKey, language)}
        >
          {refreshMonitoring.isPending ? '...' : t('refresh' as LangKey, language)}
        </button>
      </div>

      {/* Active sub-view */}
      <div className="flex-1 min-h-0 overflow-y-auto">{renderSubView()}</div>
    </div>
  );
}
