'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiKeyCreated extends ApiKey {
  key: string;
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

export const apiKeyKeys = {
  list: (orgId: string) => ['api-keys', orgId] as const,
};

export function useApiKeys() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: apiKeyKeys.list(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ApiKey[]>>(`/organizations/${orgId}/api-keys`);
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useCreateApiKey() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; scopes?: string[] }) => {
      const { data } = await api.post<ApiResponse<ApiKeyCreated>>(
        `/organizations/${orgId}/api-keys`,
        input,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: apiKeyKeys.list(orgId) });
      }
    },
  });
}

export function useRevokeApiKey() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyId: string) => {
      await api.delete(`/organizations/${orgId}/api-keys/${keyId}`);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: apiKeyKeys.list(orgId) });
      }
    },
  });
}
