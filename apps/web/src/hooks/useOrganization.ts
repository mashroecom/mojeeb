'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  websiteUrl?: string | null;
  timezone: string;
  defaultLanguage: string;
  createdAt: string;
  updatedAt: string;
  _count?: { memberships: number; agents: number; channels: number };
}

export interface OrgMember {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

export const organizationKeys = {
  detail: (orgId: string) => ['organizations', orgId] as const,
  members: (orgId: string) => ['organizations', orgId, 'members'] as const,
};

export function useOrganization() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: organizationKeys.detail(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Organization>>(`/organizations/${orgId}`);
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useUpdateOrganization() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name?: string;
      slug?: string;
      websiteUrl?: string;
      timezone?: string;
      defaultLanguage?: string;
    }) => {
      const { data } = await api.patch<ApiResponse<Organization>>(`/organizations/${orgId}`, input);
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: organizationKeys.detail(orgId) });
      }
    },
  });
}

export function useOrgMembers() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: organizationKeys.members(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<OrgMember[]>>(`/organizations/${orgId}/members`);
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useInviteMember() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; role: 'ADMIN' | 'MEMBER' }) => {
      const { data } = await api.post<ApiResponse<OrgMember>>(
        `/organizations/${orgId}/members/invite`,
        input,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: organizationKeys.members(orgId) });
      }
    },
  });
}

export function useUpdateMemberRole() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { memberId: string; role: 'ADMIN' | 'MEMBER' }) => {
      const { data } = await api.patch<ApiResponse<OrgMember>>(
        `/organizations/${orgId}/members/${input.memberId}/role`,
        { role: input.role },
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: organizationKeys.members(orgId) });
      }
    },
  });
}

export function useRemoveMember() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const { data } = await api.delete<ApiResponse<{ success: true }>>(
        `/organizations/${orgId}/members/${memberId}`,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: organizationKeys.members(orgId) });
      }
    },
  });
}

export function useTransferOwnership() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (membershipId: string) => {
      const { data } = await api.post<ApiResponse<{ success: true }>>(
        `/organizations/${orgId}/members/transfer-ownership`,
        { membershipId },
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: organizationKeys.members(orgId) });
      }
    },
  });
}
