'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastError: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookWithSecret extends Webhook {
  secret: string;
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  url: string;
  requestBody: string | null;
  responseBody: string | null;
  statusCode: number | null;
  success: boolean;
  duration: number | null;
  attempt: number;
  error: string | null;
  createdAt: string;
}

const webhookKeys = {
  all: (orgId: string) => ['organizations', orgId, 'webhooks'] as const,
  logs: (orgId: string, webhookId: string) =>
    ['organizations', orgId, 'webhooks', webhookId, 'logs'] as const,
};

export function useWebhooks() {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: webhookKeys.all(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Webhook[]>>(`/organizations/${orgId}/webhooks`);
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useCreateWebhook() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { url: string; events: string[] }) => {
      const { data } = await api.post<ApiResponse<WebhookWithSecret>>(
        `/organizations/${orgId}/webhooks`,
        input,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.all(orgId!) });
    },
  });
}

export function useUpdateWebhook() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      webhookId,
      ...input
    }: {
      webhookId: string;
      url?: string;
      events?: string[];
      isActive?: boolean;
    }) => {
      const { data } = await api.patch<ApiResponse<Webhook>>(
        `/organizations/${orgId}/webhooks/${webhookId}`,
        input,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.all(orgId!) });
    },
  });
}

export function useDeleteWebhook() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (webhookId: string) => {
      await api.delete(`/organizations/${orgId}/webhooks/${webhookId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.all(orgId!) });
    },
  });
}

export function useTestWebhook() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (webhookId: string) => {
      const { data } = await api.post<ApiResponse<{ message: string }>>(
        `/organizations/${orgId}/webhooks/${webhookId}/test`,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.all(orgId!) });
    },
  });
}

export function useRegenerateWebhookSecret() {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async (webhookId: string) => {
      const { data } = await api.post<ApiResponse<{ secret: string }>>(
        `/organizations/${orgId}/webhooks/${webhookId}/regenerate-secret`,
      );
      return data.data;
    },
  });
}

export function useWebhookLogs(webhookId: string | null) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: webhookKeys.logs(orgId!, webhookId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<WebhookLog[]>>(
        `/organizations/${orgId}/webhooks/${webhookId}/logs?limit=10`,
      );
      return data.data;
    },
    enabled: !!orgId && !!webhookId,
  });
}
