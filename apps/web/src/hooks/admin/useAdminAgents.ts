'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminAgentKeys = {
  all: (params?: Record<string, unknown>) => ['admin', 'agents', params] as const,
  detail: (id: string) => ['admin', 'agents', id] as const,
  stats: ['admin', 'agents-stats'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * List all agents across all organizations with pagination and filtering.
 * Admin-only endpoint.
 */
export function useAdminAgents(params: {
  page: number;
  limit: number;
  search?: string;
  orgId?: string;
  provider?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: adminAgentKeys.all(params),
    queryFn: async () => {
      const sp = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit)
      });
      if (params.search) sp.set('search', params.search);
      if (params.orgId) sp.set('orgId', params.orgId);
      if (params.provider) sp.set('provider', params.provider);
      if (params.status) sp.set('status', params.status);
      const { data } = await api.get(`/admin/agents?${sp}`);
      return data.data;
    },
  });
}

/**
 * Get a single agent by ID.
 * Admin-only endpoint - can view any agent across all organizations.
 */
export function useAdminAgentDetail(agentId: string) {
  return useQuery({
    queryKey: adminAgentKeys.detail(agentId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/agents/${agentId}`);
      return data.data;
    },
    enabled: !!agentId,
  });
}

/**
 * Get platform-wide agent statistics.
 * Admin-only endpoint.
 */
export function useAdminAgentStats() {
  return useQuery({
    queryKey: adminAgentKeys.stats,
    queryFn: async () => {
      const { data } = await api.get('/admin/agents/stats');
      return data.data;
    },
  });
}

/**
 * Update an agent as admin.
 * Invalidates the agents list on success.
 */
export function useUpdateAdminAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ agentId, ...body }: { agentId: string; [key: string]: unknown }) => {
      const { data } = await api.patch(`/admin/agents/${agentId}`, body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
    },
  });
}

/**
 * Delete an agent as admin.
 * Invalidates the agents list on success.
 */
export function useDeleteAdminAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (agentId: string) => {
      const { data } = await api.delete(`/admin/agents/${agentId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
    },
  });
}
