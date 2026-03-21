import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export function useLocalSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ['local-settings'],
    queryFn: () => apiFetch('/local-settings'),
  });
}

export function useSetLocalSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiFetch(`/local-settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['local-settings'] }),
  });
}

export function useDeleteLocalSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => apiFetch(`/local-settings/${key}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['local-settings'] }),
  });
}
