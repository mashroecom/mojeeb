'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminLogKeys = {
  errorLogs: (params?: Record<string, unknown>) => ['admin', 'error-logs', params] as const,
  webhookLogs: (params?: Record<string, unknown>) => ['admin', 'webhook-logs', params] as const,
  webhookLogStats: ['admin', 'webhook-log-stats'] as const,
};

// ---------------------------------------------------------------------------
// Error Log Hooks
// ---------------------------------------------------------------------------

/**
 * Get error logs from the system with pagination and filtering.
 * Admin-only endpoint for monitoring application errors.
 */
export function useAdminErrorLogs(params: { page: number; limit: number; search?: string; level?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: adminLogKeys.errorLogs(params),
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
      if (params.search) sp.set('search', params.search);
      if (params.level) sp.set('level', params.level);
      if (params.startDate) sp.set('startDate', params.startDate);
      if (params.endDate) sp.set('endDate', params.endDate);
      const { data } = await api.get(`/admin/error-logs?${sp}`);
      return data.data;
    },
  });
}

/**
 * Delete an error log entry from the system.
 * Admin can remove error logs to clean up old or irrelevant entries.
 */
export function useDeleteAdminErrorLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/error-logs/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'error-logs'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Webhook Log Hooks
// ---------------------------------------------------------------------------

/**
 * Get webhook logs from the system with pagination and filtering.
 * Admin-only endpoint for monitoring webhook deliveries and failures.
 */
export function useAdminWebhookLogs(params: { page: number; limit: number; search?: string; status?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: adminLogKeys.webhookLogs(params),
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
      if (params.search) sp.set('search', params.search);
      if (params.status) sp.set('status', params.status);
      if (params.startDate) sp.set('startDate', params.startDate);
      if (params.endDate) sp.set('endDate', params.endDate);
      const { data } = await api.get(`/admin/webhook-logs?${sp}`);
      return data.data;
    },
  });
}

/**
 * Get webhook log statistics including success/failure rates and trends.
 * Provides insights on webhook delivery performance and reliability.
 */
export function useAdminWebhookLogStats() {
  return useQuery({
    queryKey: adminLogKeys.webhookLogStats,
    queryFn: async () => {
      const { data } = await api.get('/admin/webhook-logs/stats');
      return data.data;
    },
  });
}

/**
 * Delete a webhook log entry from the system.
 * Admin can remove webhook logs to clean up old or irrelevant entries.
 */
export function useDeleteAdminWebhookLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/webhook-logs/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhook-logs'] });
    },
  });
}
