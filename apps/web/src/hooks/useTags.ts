'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Tag {
  id: string;
  orgId: string;
  name: string;
  color: string;
  createdAt: string;
  _count?: {
    conversations: number;
  };
}

export interface ConversationTag {
  id: string;
  conversationId: string;
  tagId: string;
  tag: Tag;
  createdAt: string;
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

// ---------------------------------------------------------------------------
// Param types
// ---------------------------------------------------------------------------

export interface CreateTagParams {
  name: string;
  color?: string;
}

export interface UpdateTagParams {
  name?: string;
  color?: string;
}

export interface AddTagToConversationParams {
  tagId: string;
  conversationId: string;
}

export interface RemoveTagFromConversationParams {
  tagId: string;
  conversationId: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const tagKeys = {
  all: (orgId: string) => ['organizations', orgId, 'tags'] as const,
  list: (orgId: string) => [...tagKeys.all(orgId), 'list'] as const,
  detail: (orgId: string, tagId: string) =>
    [...tagKeys.all(orgId), 'detail', tagId] as const,
};

// ---------------------------------------------------------------------------
// useTags - fetch all tags for organization
// ---------------------------------------------------------------------------

export function useTags() {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: tagKeys.list(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Tag[]>>(
        `/organizations/${orgId}/tags`,
      );
      return data;
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
    mutationFn: async (params: CreateTagParams) => {
      const { data } = await api.post<ApiResponse<Tag>>(
        `/organizations/${orgId}/tags`,
        params,
      );
      return data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: tagKeys.all(orgId),
        });
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
      ...params
    }: UpdateTagParams & { tagId: string }) => {
      const { data } = await api.patch<ApiResponse<Tag>>(
        `/organizations/${orgId}/tags/${tagId}`,
        params,
      );
      return data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: tagKeys.all(orgId),
        });
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
        queryClient.invalidateQueries({
          queryKey: tagKeys.all(orgId),
        });
        // Also invalidate conversations since tag counts may have changed
        queryClient.invalidateQueries({
          queryKey: ['organizations', orgId, 'conversations'],
        });
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
    mutationFn: async ({ tagId, conversationId }: AddTagToConversationParams) => {
      const { data } = await api.post<ApiResponse<ConversationTag>>(
        `/organizations/${orgId}/tags/${tagId}/conversations/${conversationId}`,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        // Invalidate the specific conversation to refresh its tags
        queryClient.invalidateQueries({
          queryKey: ['organizations', orgId, 'conversations', 'detail', variables.conversationId],
        });
        // Invalidate conversation list to update tag display
        queryClient.invalidateQueries({
          queryKey: ['organizations', orgId, 'conversations', 'list'],
        });
        // Invalidate tags to update conversation counts
        queryClient.invalidateQueries({
          queryKey: tagKeys.all(orgId),
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
    mutationFn: async ({ tagId, conversationId }: RemoveTagFromConversationParams) => {
      const { data } = await api.delete<ApiResponse<void>>(
        `/organizations/${orgId}/tags/${tagId}/conversations/${conversationId}`,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        // Invalidate the specific conversation to refresh its tags
        queryClient.invalidateQueries({
          queryKey: ['organizations', orgId, 'conversations', 'detail', variables.conversationId],
        });
        // Invalidate conversation list to update tag display
        queryClient.invalidateQueries({
          queryKey: ['organizations', orgId, 'conversations', 'list'],
        });
        // Invalidate tags to update conversation counts
        queryClient.invalidateQueries({
          queryKey: tagKeys.all(orgId),
        });
      }
    },
  });
}
