'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminApiKeyKeys = {
  all: (params?: Record<string, unknown>) => ['admin', 'api-keys', params] as const,
  stats: ['admin', 'api-keys-stats'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * List all API keys across all organizations with pagination and filtering.
 * Admin-only endpoint.
 */
export function useAdminApiKeys(params: {
  page: number;
  limit: number;
  search?: string;
  orgId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: adminApiKeyKeys.all(params),
    queryFn: async () => {
      const sp = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit)
      });
      if (params.search) sp.set('search', params.search);
      if (params.orgId) sp.set('orgId', params.orgId);
      if (params.status) sp.set('status', params.status);
      const { data } = await api.get(`/admin/api-keys?${sp}`);
      return data.data;
    },
  });
}

/**
 * Get platform-wide API key statistics.
 * Admin-only endpoint.
 */
export function useAdminApiKeyStats() {
  return useQuery({
    queryKey: adminApiKeyKeys.stats,
    queryFn: async () => {
      const { data } = await api.get('/admin/api-keys/stats');
      return data.data;
    },
  });
}

/**
 * Revoke an API key as admin.
 * Invalidates the API keys list on success.
 */
export function useRevokeAdminApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (keyId: string) => {
      const { data } = await api.patch(`/admin/api-keys/${keyId}/revoke`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
    },
  });
}

/**
 * Delete an API key as admin.
 * Invalidates the API keys list on success.
 */
export function useDeleteAdminApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (keyId: string) => {
      const { data } = await api.delete(`/admin/api-keys/${keyId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
    },
  });
}
