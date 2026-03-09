'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const adminOrgKeys = {
  orgs: (params?: object) => ['admin', 'organizations', params] as const,
  orgDetail: (orgId: string) => ['admin', 'organizations', orgId] as const,
  orgMembers: (orgId: string) => ['admin', 'organizations', orgId, 'members'] as const,
};

// ===== Organization Management =====

export function useAdminOrganizations(params: { page: number; limit: number; search?: string; status?: string }) {
  return useQuery({
    queryKey: adminOrgKeys.orgs(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.search) searchParams.set('search', params.search);
      if (params.status) searchParams.set('status', params.status);
      const { data } = await api.get(`/admin/organizations?${searchParams}`);
      return data.data;
    },
  });
}

export function useAdminOrgDetail(orgId: string) {
  return useQuery({
    queryKey: adminOrgKeys.orgDetail(orgId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/organizations/${orgId}`);
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useAdminOrgMembers(orgId: string) {
  return useQuery({
    queryKey: adminOrgKeys.orgMembers(orgId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/organizations/${orgId}/members`);
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useToggleOrgSuspension() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      const { data } = await api.patch(`/admin/organizations/${orgId}/suspend`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      const { data } = await api.delete(`/admin/organizations/${orgId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    },
  });
}

export function useBulkSuspendOrgs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orgIds: string[]) => {
      const { data } = await api.post('/admin/organizations/bulk-suspend', { orgIds });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    },
  });
}

export function useBulkUnsuspendOrgs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orgIds: string[]) => {
      const { data } = await api.post('/admin/organizations/bulk-unsuspend', { orgIds });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    },
  });
}

export function useUpdateAdminOrg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, ...body }: { orgId: string; [key: string]: unknown }) => {
      const { data } = await api.patch(`/admin/organizations/${orgId}`, body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    },
  });
}
