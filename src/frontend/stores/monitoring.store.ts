import { create } from 'zustand';

export type MonitoringSubView =
  | 'dashboard'
  | 'kubernetes'
  | 'databases'
  | 'applications'
  | 'network'
  | 'storage'
  | 'docker'
  | 'security'
  | 'backups'
  | 'iot'
  | 'alerts';

export type TimeRange = '1h' | '6h' | '24h' | '7d';

interface MonitoringState {
  activeSubView: MonitoringSubView;
  selectedResource: { type: string; name: string; namespace?: string } | null;
  timeRange: TimeRange;
  setActiveSubView: (view: MonitoringSubView) => void;
  setSelectedResource: (resource: { type: string; name: string; namespace?: string } | null) => void;
  setTimeRange: (range: TimeRange) => void;
}

export const useMonitoringStore = create<MonitoringState>((set) => ({
  activeSubView: 'dashboard',
  selectedResource: null,
  timeRange: '24h',
  setActiveSubView: (activeSubView) => set({ activeSubView }),
  setSelectedResource: (selectedResource) => set({ selectedResource }),
  setTimeRange: (timeRange) => set({ timeRange }),
}));
