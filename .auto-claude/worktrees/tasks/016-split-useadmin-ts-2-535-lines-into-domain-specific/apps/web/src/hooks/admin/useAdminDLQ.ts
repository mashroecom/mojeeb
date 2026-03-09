'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminDLQKeys = {
  dlq: (params?: Record<string, unknown>) => ['admin', 'dlq', params] as const,
};

// ---------------------------------------------------------------------------
// Dead Letter Queue Hooks
// ---------------------------------------------------------------------------

/**
 * Get dead letter queue jobs with pagination and filtering.
 * Admin-only endpoint for monitoring failed jobs that need manual intervention.
 */
export function useAdminDLQ(params: { page: number; limit: number; search?: string; status?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: adminDLQKeys.dlq(params),
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
      if (params.search) sp.set('search', params.search);
      if (params.status) sp.set('status', params.status);
      if (params.startDate) sp.set('startDate', params.startDate);
      if (params.endDate) sp.set('endDate', params.endDate);
      const { data } = await api.get(`/admin/dlq?${sp}`);
      return data.data;
    },
  });
}

/**
 * Retry a failed job from the dead letter queue.
 * Attempts to re-process a failed job by moving it back to the main queue.
 */
export function useRetryAdminDLQJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/admin/dlq/${id}/retry`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dlq'] });
    },
  });
}

/**
 * Delete a job from the dead letter queue.
 * Permanently removes a failed job that cannot be recovered or is no longer needed.
 */
export function useDeleteAdminDLQJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/dlq/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dlq'] });
    },
  });
}
