'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export interface MessageTemplate {
  id: string;
  orgId: string;
  title: string;
  content: string;
  category: string | null;
  shortcut: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

const templateKeys = {
  all: (orgId: string) => ['organizations', orgId, 'message-templates'] as const,
};

export function useMessageTemplates() {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: templateKeys.all(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MessageTemplate[]>>(
        `/organizations/${orgId}/message-templates`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useCreateTemplate() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      title: string;
      content: string;
      category?: string;
      shortcut?: string;
    }) => {
      const { data } = await api.post<ApiResponse<MessageTemplate>>(
        `/organizations/${orgId}/message-templates`,
        payload,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: templateKeys.all(orgId) });
      }
    },
  });
}

export function useUpdateTemplate() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      ...payload
    }: {
      templateId: string;
      title?: string;
      content?: string;
      category?: string;
      shortcut?: string;
    }) => {
      const { data } = await api.patch<ApiResponse<MessageTemplate>>(
        `/organizations/${orgId}/message-templates/${templateId}`,
        payload,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: templateKeys.all(orgId) });
      }
    },
  });
}

export function useDeleteTemplate() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      await api.delete(`/organizations/${orgId}/message-templates/${templateId}`);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: templateKeys.all(orgId) });
      }
    },
  });
}
