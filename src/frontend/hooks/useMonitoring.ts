import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

// ── Types ──────────────────────────────────────────────────────────

export interface CategorySummary {
  category: string;
  total: number;
  healthy: number;
  warning: number;
  critical: number;
}

export interface MonitoringDashboard {
  enabled: boolean;
  summary: CategorySummary[];
  activeAlerts: MonitoringAlert[];
  lastUpdate: string;
}

export interface MonitoringSnapshot {
  id: number;
  category: string;
  resource_type: string;
  resource_name: string;
  namespace: string | null;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  value_json: string;
  collected_at: string;
}

export interface MonitoringAlert {
  id: number;
  category: string;
  resource_name: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  acknowledged: number;
  resolved_at: string | null;
  created_at: string;
}

// ── Query hooks ────────────────────────────────────────────────────

export function useMonitoringDashboard() {
  return useQuery<MonitoringDashboard>({
    queryKey: ['monitoring', 'dashboard'],
    queryFn: () => apiFetch('/monitoring/dashboard'),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

export function useKubernetes() {
  return useQuery<MonitoringSnapshot[]>({
    queryKey: ['monitoring', 'kubernetes'],
    queryFn: () => apiFetch('/monitoring/kubernetes'),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

export function useKubernetesDetail(resourceType: string, name: string) {
  return useQuery<MonitoringSnapshot[]>({
    queryKey: ['monitoring', 'kubernetes', resourceType, name],
    queryFn: () =>
      apiFetch(`/monitoring/kubernetes/${encodeURIComponent(resourceType)}/${encodeURIComponent(name)}`),
    enabled: !!(resourceType && name),
    retry: 1,
  });
}

export function useDatabases() {
  return useQuery<MonitoringSnapshot[]>({
    queryKey: ['monitoring', 'databases'],
    queryFn: () => apiFetch('/monitoring/databases'),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
}

export function useApplications() {
  return useQuery<MonitoringSnapshot[]>({
    queryKey: ['monitoring', 'applications'],
    queryFn: () => apiFetch('/monitoring/applications'),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
}

export function useNetwork() {
  return useQuery<MonitoringSnapshot[]>({
    queryKey: ['monitoring', 'network'],
    queryFn: () => apiFetch('/monitoring/network'),
    staleTime: 120_000,
    refetchInterval: 300_000,
    retry: 1,
  });
}

export function useStorage() {
  return useQuery<MonitoringSnapshot[]>({
    queryKey: ['monitoring', 'storage'],
    queryFn: () => apiFetch('/monitoring/storage'),
    staleTime: 120_000,
    refetchInterval: 300_000,
    retry: 1,
  });
}

export function useDocker() {
  return useQuery<MonitoringSnapshot[]>({
    queryKey: ['monitoring', 'docker'],
    queryFn: () => apiFetch('/monitoring/docker'),
    staleTime: 120_000,
    refetchInterval: 300_000,
    retry: 1,
  });
}

export function useSecurity() {
  return useQuery<MonitoringSnapshot[]>({
    queryKey: ['monitoring', 'security'],
    queryFn: () => apiFetch('/monitoring/security'),
    staleTime: 120_000,
    refetchInterval: 600_000,
    retry: 1,
  });
}

export function useBackups() {
  return useQuery<MonitoringSnapshot[]>({
    queryKey: ['monitoring', 'backups'],
    queryFn: () => apiFetch('/monitoring/backups'),
    staleTime: 300_000,
    refetchInterval: 3_600_000,
    retry: 1,
  });
}

export function useIoT() {
  return useQuery<MonitoringSnapshot[]>({
    queryKey: ['monitoring', 'iot'],
    queryFn: () => apiFetch('/monitoring/iot'),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
}

export function useMonitoringAlerts() {
  return useQuery<MonitoringAlert[]>({
    queryKey: ['monitoring', 'alerts'],
    queryFn: () => apiFetch('/monitoring/alerts'),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

// ── Mutation hooks ─────────────────────────────────────────────────

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/monitoring/alerts/${id}/acknowledge`, {
        method: 'PATCH',
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['monitoring', 'alerts'] });
      qc.invalidateQueries({ queryKey: ['monitoring', 'dashboard'] });
    },
  });
}

export function useRefreshMonitoring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch('/monitoring/refresh', {
        method: 'POST',
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['monitoring'] });
    },
  });
}

// ── History & config hooks ─────────────────────────────────────────

export function useMonitoringHistory(params: {
  category?: string;
  resource?: string;
  range?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set('category', params.category);
  if (params.resource) searchParams.set('resource', params.resource);
  if (params.range) searchParams.set('range', params.range);
  const qs = searchParams.toString();

  return useQuery<MonitoringSnapshot[]>({
    queryKey: ['monitoring', 'history', params],
    queryFn: () => apiFetch(`/monitoring/history${qs ? `?${qs}` : ''}`),
    enabled: !!(params.category || params.resource || params.range),
    retry: 1,
  });
}

export function useMonitoringConfig() {
  return useQuery<Record<string, unknown>>({
    queryKey: ['monitoring', 'config'],
    queryFn: () => apiFetch('/monitoring/config'),
    retry: 1,
  });
}
