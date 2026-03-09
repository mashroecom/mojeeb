'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const adminSystemKeys = {
  system: ['admin', 'system'] as const,
  queues: ['admin', 'queues'] as const,
  dbStats: ['admin', 'db-stats'] as const,
};

// System Health
export function useSystemHealth() {
  return useQuery({
    queryKey: adminSystemKeys.system,
    queryFn: async () => {
      const { data } = await api.get('/admin/system/health');
      return data.data;
    },
    refetchInterval: 30000,
  });
}

export function useSystemQueues() {
  return useQuery({
    queryKey: adminSystemKeys.queues,
    queryFn: async () => {
      const { data } = await api.get('/admin/system/queues');
      return data.data;
    },
    refetchInterval: 15000,
  });
}

export function useSystemDbStats() {
  return useQuery({
    queryKey: adminSystemKeys.dbStats,
    queryFn: async () => {
      const { data } = await api.get('/admin/system/db-stats');
      return data.data;
    },
  });
}
