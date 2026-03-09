'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Lead, LeadStats } from '@/hooks/useLeads';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminLeadKeys = {
  all: (params?: Record<string, unknown>) => ['admin', 'leads', params] as const,
  detail: (id: string) => ['admin', 'leads', id] as const,
  stats: ['admin', 'leads-stats'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * List all leads across all organizations with pagination and filtering.
 * Admin-only endpoint.
 */
export function useAdminLeads(params: {
  page: number;
  limit: number;
  search?: string;
  orgId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: adminLeadKeys.all(params),
    queryFn: async () => {
      const sp = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.search) sp.set('search', params.search);
      if (params.orgId) sp.set('orgId', params.orgId);
      if (params.status) sp.set('status', params.status);
      const { data } = await api.get(`/admin/leads?${sp}`);
      return data.data;
    },
  });
}

/**
 * Get a single lead by ID.
 * Admin-only endpoint - can view any lead across all organizations.
 */
export function useAdminLeadDetail(leadId: string) {
  return useQuery({
    queryKey: adminLeadKeys.detail(leadId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/leads/${leadId}`);
      return data.data;
    },
    enabled: !!leadId,
  });
}

/**
 * Get platform-wide lead statistics.
 * Admin-only endpoint.
 */
export function useAdminLeadStats() {
  return useQuery({
    queryKey: adminLeadKeys.stats,
    queryFn: async () => {
      const { data } = await api.get('/admin/leads/stats');
      return data.data;
    },
  });
}

/**
 * Update a lead as admin.
 * Invalidates the leads list on success.
 */
export function useUpdateAdminLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, ...body }: { leadId: string; [key: string]: unknown }) => {
      const { data } = await api.patch(`/admin/leads/${leadId}`, body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
    },
  });
}

/**
 * Delete a lead as admin.
 * Invalidates the leads list on success.
 */
export function useDeleteAdminLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data } = await api.delete(`/admin/leads/${leadId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
    },
  });
}

/**
 * Bulk update lead status for multiple leads.
 * Admin-only endpoint for batch operations.
 */
export function useBulkUpdateLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadIds, status }: { leadIds: string[]; status: string }) => {
      const { data } = await api.post('/admin/leads/bulk-status', { leadIds, status });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
    },
  });
}

/**
 * Bulk delete multiple leads.
 * Admin-only endpoint for batch operations.
 */
export function useBulkDeleteLeads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { data } = await api.post('/admin/leads/bulk-delete', { leadIds });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
    },
  });
}
