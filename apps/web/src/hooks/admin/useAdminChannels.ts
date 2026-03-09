'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminChannelKeys = {
  all: (params?: Record<string, unknown>) => ['admin', 'channels', params] as const,
  detail: (id: string) => ['admin', 'channels', id] as const,
  stats: ['admin', 'channels-stats'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * List all channels across all organizations with pagination and filtering.
 * Admin-only endpoint.
 */
export function useAdminChannels(params: {
  page: number;
  limit: number;
  search?: string;
  orgId?: string;
  type?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: adminChannelKeys.all(params),
    queryFn: async () => {
      const sp = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit)
      });
      if (params.search) sp.set('search', params.search);
      if (params.orgId) sp.set('orgId', params.orgId);
      if (params.type) sp.set('type', params.type);
      if (params.status) sp.set('status', params.status);
      const { data } = await api.get(`/admin/channels?${sp}`);
      return data.data;
    },
  });
}

/**
 * Get a single channel by ID.
 * Admin-only endpoint - can view any channel across all organizations.
 */
export function useAdminChannelDetail(channelId: string) {
  return useQuery({
    queryKey: adminChannelKeys.detail(channelId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/channels/${channelId}`);
      return data.data;
    },
    enabled: !!channelId,
  });
}

/**
 * Get platform-wide channel statistics.
 * Admin-only endpoint.
 */
export function useAdminChannelStats() {
  return useQuery({
    queryKey: adminChannelKeys.stats,
    queryFn: async () => {
      const { data } = await api.get('/admin/channels/stats');
      return data.data;
    },
  });
}

/**
 * Update a channel as admin.
 * Invalidates the channels list on success.
 */
export function useUpdateAdminChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, ...body }: { channelId: string; [key: string]: unknown }) => {
      const { data } = await api.patch(`/admin/channels/${channelId}`, body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'channels'] });
    },
  });
}

/**
 * Delete a channel as admin.
 * Invalidates the channels list on success.
 */
export function useDeleteAdminChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data } = await api.delete(`/admin/channels/${channelId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'channels'] });
    },
  });
}
