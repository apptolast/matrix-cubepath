import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface GitHubStatus {
  configured: boolean;
  connected: boolean;
  username?: string;
}

export function useSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => apiFetch('/settings'),
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiFetch(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['github-status'] });
    },
  });
}

export function useGitHubStatus() {
  return useQuery<GitHubStatus>({
    queryKey: ['github-status'],
    queryFn: () => apiFetch('/settings/github-status'),
  });
}
