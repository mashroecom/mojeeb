'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  confidence: number;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
  source: string | null;
  conversationId: string | null;
  conversation: { id: string; customerName: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  converted: number;
  lost: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiResponse<T> {
  success: true;
  data: T;
  pagination?: Pagination;
}

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export interface LeadsParams {
  page?: number;
  limit?: number;
  status?: Lead['status'];
  search?: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const leadKeys = {
  all: (orgId: string) => ['organizations', orgId, 'leads'] as const,
  list: (orgId: string, params?: LeadsParams) =>
    [...leadKeys.all(orgId), 'list', params ?? {}] as const,
  stats: (orgId: string) => [...leadKeys.all(orgId), 'stats'] as const,
};

// ---------------------------------------------------------------------------
// useLeads - paginated list
// ---------------------------------------------------------------------------

export function useLeads(params?: LeadsParams) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: leadKeys.list(orgId!, params),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Lead[]>>(`/organizations/${orgId}/leads`, {
        params,
      });
      return data;
    },
    enabled: !!orgId,
  });
}

// ---------------------------------------------------------------------------
// useLeadStats
// ---------------------------------------------------------------------------

export function useLeadStats() {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: leadKeys.stats(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<LeadStats>>(`/organizations/${orgId}/leads/stats`);
      return data.data;
    },
    enabled: !!orgId,
  });
}

// ---------------------------------------------------------------------------
// useCreateLead - mutation
// ---------------------------------------------------------------------------

export interface CreateLeadInput {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  notes?: string;
  status?: Lead['status'];
}

export function useCreateLead() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLeadInput) => {
      const { data } = await api.post<ApiResponse<Lead>>(`/organizations/${orgId}/leads`, input);
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: leadKeys.all(orgId) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateLead - mutation (full update)
// ---------------------------------------------------------------------------

export function useUpdateLead() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, ...input }: CreateLeadInput & { leadId: string }) => {
      const { data } = await api.patch<ApiResponse<Lead>>(
        `/organizations/${orgId}/leads/${leadId}`,
        input,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: leadKeys.all(orgId) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateLeadStatus - mutation
// ---------------------------------------------------------------------------

export function useUpdateLeadStatus() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: Lead['status'] }) => {
      const { data } = await api.patch<ApiResponse<Lead>>(
        `/organizations/${orgId}/leads/${leadId}/status`,
        { status },
      );
      return data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: leadKeys.all(orgId) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteLead - mutation
// ---------------------------------------------------------------------------

export function useDeleteLead() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId }: { leadId: string }) => {
      const { data } = await api.delete<ApiResponse<null>>(
        `/organizations/${orgId}/leads/${leadId}`,
      );
      return data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: leadKeys.all(orgId) });
      }
    },
  });
}
