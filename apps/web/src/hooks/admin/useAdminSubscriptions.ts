'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminSubscriptionKeys = {
  all: ['admin', 'subscriptions'] as const,
  lists: () => [...adminSubscriptionKeys.all, 'list'] as const,
  list: (params?: object) => [...adminSubscriptionKeys.lists(), params] as const,
  details: () => [...adminSubscriptionKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminSubscriptionKeys.details(), id] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAdminSubscriptions(params: { page: number; limit: number; plan?: string; status?: string }) {
  return useQuery({
    queryKey: adminSubscriptionKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.plan) searchParams.set('plan', params.plan);
      if (params.status) searchParams.set('status', params.status);
      const { data } = await api.get(`/admin/subscriptions?${searchParams}`);
      return data.data;
    },
  });
}

export function useAdminSubscriptionDetail(id: string) {
  return useQuery({
    queryKey: adminSubscriptionKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/admin/subscriptions/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; plan?: string; messagesLimit?: number; agentsLimit?: number; integrationsLimit?: number }) => {
      const { data } = await api.patch(`/admin/subscriptions/${id}`, body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSubscriptionKeys.all });
    },
  });
}
