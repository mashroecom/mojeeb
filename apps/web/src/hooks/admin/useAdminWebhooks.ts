'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const adminWebhookKeys = {
  all: ['admin', 'webhooks'] as const,
  lists: () => [...adminWebhookKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...adminWebhookKeys.lists(), params] as const,
  details: () => [...adminWebhookKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminWebhookKeys.details(), id] as const,
  stats: () => [...adminWebhookKeys.all, 'stats'] as const,
  logs: () => [...adminWebhookKeys.all, 'logs'] as const,
  logsList: (params?: Record<string, unknown>) => [...adminWebhookKeys.logs(), params] as const,
  logStats: () => [...adminWebhookKeys.logs(), 'stats'] as const,
};

export function useAdminWebhooks(params: {
  page: number;
  limit: number;
  orgId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: adminWebhookKeys.list(params),
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
      if (params.orgId) sp.set('orgId', params.orgId);
      if (params.status) sp.set('status', params.status);
      const { data } = await api.get(`/admin/webhooks?${sp}`);
      return data.data;
    },
  });
}

export function useAdminWebhookDetail(webhookId: string) {
  return useQuery({
    queryKey: adminWebhookKeys.detail(webhookId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/webhooks/${webhookId}`);
      return data.data;
    },
    enabled: !!webhookId,
  });
}

export function useAdminWebhookStats() {
  return useQuery({
    queryKey: adminWebhookKeys.stats(),
    queryFn: async () => {
      const { data } = await api.get('/admin/webhooks/stats');
      return data.data;
    },
  });
}

export function useUpdateAdminWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ webhookId, ...body }: { webhookId: string; [key: string]: unknown }) => {
      const { data } = await api.patch(`/admin/webhooks/${webhookId}`, body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminWebhookKeys.all });
    },
  });
}

export function useDeleteAdminWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (webhookId: string) => {
      const { data } = await api.delete(`/admin/webhooks/${webhookId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminWebhookKeys.all });
    },
  });
}

export function useAdminWebhookLogs(params: {
  page: number;
  limit: number;
  webhookId?: string;
  event?: string;
  success?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: adminWebhookKeys.logsList(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.webhookId) searchParams.set('webhookId', params.webhookId);
      if (params.event) searchParams.set('event', params.event);
      if (params.success) searchParams.set('success', params.success);
      if (params.startDate) searchParams.set('startDate', params.startDate);
      if (params.endDate) searchParams.set('endDate', params.endDate);
      if (params.search) searchParams.set('search', params.search);
      const { data } = await api.get(`/admin/webhook-logs?${searchParams}`);
      return data.data;
    },
  });
}

export function useAdminWebhookLogStats() {
  return useQuery({
    queryKey: adminWebhookKeys.logStats(),
    queryFn: async () => {
      const { data } = await api.get('/admin/webhook-logs/stats');
      return data.data;
    },
    refetchInterval: 30000,
  });
}
