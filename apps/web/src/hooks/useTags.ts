'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { conversationKeys } from './useConversations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Tag {
  id: string;
  name: string;
  color: string;
  orgId: string;
  _count?: {
    conversations: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export interface CreateTagInput {
  name: string;
  color: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const tagKeys = {
  all: (orgId: string) => ['organizations', orgId, 'tags'] as const,
  list: (orgId: string) => [...tagKeys.all(orgId), 'list'] as const,
  conversationTags: (orgId: string, convId: string) =>
    [...tagKeys.all(orgId), 'conversation', convId] as const,
};

// ---------------------------------------------------------------------------
// useTags - list all tags for organization
// ---------------------------------------------------------------------------

export function useTags() {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: tagKeys.list(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Tag[]>>(
        `/organizations/${orgId}/tags`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}

// ---------------------------------------------------------------------------
// useCreateTag - mutation
// ---------------------------------------------------------------------------

export function useCreateTag() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTagInput) => {
      const { data } = await api.post<ApiResponse<Tag>>(
        `/organizations/${orgId}/tags`,
        input,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: tagKeys.all(orgId) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateTag - mutation
// ---------------------------------------------------------------------------

export function useUpdateTag() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tagId,
      ...input
    }: UpdateTagInput & { tagId: string }) => {
      const { data } = await api.patch<ApiResponse<Tag>>(
        `/organizations/${orgId}/tags/${tagId}`,
        input,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: tagKeys.all(orgId) });
        queryClient.invalidateQueries({ queryKey: conversationKeys.all(orgId) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteTag - mutation
// ---------------------------------------------------------------------------

export function useDeleteTag() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagId: string) => {
      const { data } = await api.delete<ApiResponse<void>>(
        `/organizations/${orgId}/tags/${tagId}`,
      );
      return data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: tagKeys.all(orgId) });
        queryClient.invalidateQueries({ queryKey: conversationKeys.all(orgId) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useAddTagToConversation - mutation
// ---------------------------------------------------------------------------

export function useAddTagToConversation() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tagId,
      conversationId,
    }: {
      tagId: string;
      conversationId: string;
    }) => {
      const { data } = await api.post<ApiResponse<void>>(
        `/organizations/${orgId}/tags/${tagId}/conversations/${conversationId}`,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: tagKeys.all(orgId) });
        queryClient.invalidateQueries({ queryKey: conversationKeys.all(orgId) });
        queryClient.invalidateQueries({
          queryKey: conversationKeys.detail(orgId, variables.conversationId),
        });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useRemoveTagFromConversation - mutation
// ---------------------------------------------------------------------------

export function useRemoveTagFromConversation() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tagId,
      conversationId,
    }: {
      tagId: string;
      conversationId: string;
    }) => {
      const { data } = await api.delete<ApiResponse<void>>(
        `/organizations/${orgId}/tags/${tagId}/conversations/${conversationId}`,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: tagKeys.all(orgId) });
        queryClient.invalidateQueries({ queryKey: conversationKeys.all(orgId) });
        queryClient.invalidateQueries({
          queryKey: conversationKeys.detail(orgId, variables.conversationId),
        });
      }
    },
  });
}
