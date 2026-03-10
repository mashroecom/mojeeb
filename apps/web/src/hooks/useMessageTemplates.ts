'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateVariable {
  key: string;
  labelEn: string;
  labelAr?: string;
}

export interface AutoTrigger {
  enabled: boolean;
  keywords: string[];
}

export interface MessageTemplate {
  id: string;
  orgId: string;
  title: string;
  contentEn: string;
  contentAr: string;
  shortcut: string | null;
  category: string;
  variables: TemplateVariable[];
  agentId: string | null;
  isActive: boolean;
  usageCount: number;
  autoTrigger: AutoTrigger;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  title: string;
  contentEn: string;
  contentAr?: string;
  shortcut?: string | null;
  category?: string;
  variables?: TemplateVariable[];
  agentId?: string | null;
  isActive?: boolean;
  autoTrigger?: AutoTrigger;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput> & { templateId: string };

interface ApiResponse<T> {
  success: true;
  data: T;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const templateKeys = {
  all: (orgId: string) => ['organizations', orgId, 'message-templates'] as const,
  detail: (orgId: string, id: string) => ['organizations', orgId, 'message-templates', id] as const,
  shortcut: (orgId: string, shortcut: string) =>
    ['organizations', orgId, 'message-templates', 'shortcut', shortcut] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useMessageTemplates(filters?: {
  category?: string;
  search?: string;
  agentId?: string;
}) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: [...templateKeys.all(orgId!), filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.category) params.set('category', filters.category);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.agentId) params.set('agentId', filters.agentId);
      const qs = params.toString();
      const { data } = await api.get<ApiResponse<MessageTemplate[]>>(
        `/organizations/${orgId}/message-templates${qs ? `?${qs}` : ''}`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useMessageTemplate(templateId: string | undefined) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: templateKeys.detail(orgId!, templateId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MessageTemplate>>(
        `/organizations/${orgId}/message-templates/${templateId}`,
      );
      return data.data;
    },
    enabled: !!orgId && !!templateId,
  });
}

export function useTemplateByShortcut(shortcut: string | undefined) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: templateKeys.shortcut(orgId!, shortcut!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MessageTemplate>>(
        `/organizations/${orgId}/message-templates/shortcut/${shortcut}`,
      );
      return data.data;
    },
    enabled: !!orgId && !!shortcut,
  });
}

export function useCreateTemplate() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTemplateInput) => {
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
    mutationFn: async ({ templateId, ...payload }: UpdateTemplateInput) => {
      const { data } = await api.put<ApiResponse<MessageTemplate>>(
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

export function useUseTemplate() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      variables,
    }: {
      templateId: string;
      variables?: Record<string, string>;
    }) => {
      const { data } = await api.post<ApiResponse<MessageTemplate>>(
        `/organizations/${orgId}/message-templates/${templateId}/use`,
        { variables },
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
