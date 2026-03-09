'use client';

import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string | null;
  status:
    | 'ACTIVE'
    | 'HANDED_OFF'
    | 'WAITING'
    | 'RESOLVED'
    | 'ARCHIVED';
  lastEmotion: string | null;
  emotionScore: number | null;
  summary: string | null;
  channel: { id: string; name: string; type: string } | null;
  assignedUser: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  messages?: { content: string; role: string; createdAt: string }[];
  ratings?: { rating: number }[];
  tags?: Array<{ id: string; tag: { id: string; name: string; color: string } }>;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  role: 'CUSTOMER' | 'AI_AGENT' | 'HUMAN_AGENT' | 'SYSTEM';
  content: string;
  contentType: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  metadata?: { fileUrl?: string; fileName?: string } | null;
  createdAt: string;
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
// Param types
// ---------------------------------------------------------------------------

export interface ConversationsParams {
  page?: number;
  limit?: number;
  status?: Conversation['status'];
  channelId?: string;
  search?: string;
}

export interface MessagesParams {
  limit?: number;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const conversationKeys = {
  all: (orgId: string) => ['organizations', orgId, 'conversations'] as const,
  list: (orgId: string, params?: ConversationsParams) =>
    [...conversationKeys.all(orgId), 'list', params ?? {}] as const,
  detail: (orgId: string, convId: string) =>
    [...conversationKeys.all(orgId), 'detail', convId] as const,
  messages: (orgId: string, convId: string, params?: MessagesParams) =>
    [...conversationKeys.all(orgId), 'detail', convId, 'messages', params ?? {}] as const,
};

// ---------------------------------------------------------------------------
// useConversations - paginated list
// ---------------------------------------------------------------------------

export function useConversations(params?: ConversationsParams) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: conversationKeys.list(orgId!, params),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Conversation[]>>(
        `/organizations/${orgId}/conversations`,
        { params },
      );
      return data;
    },
    enabled: !!orgId,
    refetchInterval: 30000, // Reduced frequency — real-time updates come via WebSocket
  });
}

// ---------------------------------------------------------------------------
// useConversation - single detail
// ---------------------------------------------------------------------------

export function useConversation(convId: string) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: conversationKeys.detail(orgId!, convId),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Conversation>>(
        `/organizations/${orgId}/conversations/${convId}`,
      );
      return data;
    },
    enabled: !!orgId && !!convId,
  });
}

// ---------------------------------------------------------------------------
// useMessages - infinite query for paginated messages
// ---------------------------------------------------------------------------

export function useMessages(convId: string, params?: MessagesParams) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useInfiniteQuery({
    queryKey: conversationKeys.messages(orgId!, convId, params),
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get<ApiResponse<Message[]>>(
        `/organizations/${orgId}/conversations/${convId}/messages`,
        { params: { page: pageParam, limit: params?.limit } },
      );
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination) return undefined;
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    enabled: !!orgId && !!convId,
    refetchInterval: 15000, // Fallback polling — primary updates via WebSocket
  });
}

// ---------------------------------------------------------------------------
// useSendMessage - mutation
// ---------------------------------------------------------------------------

export function useSendMessage() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: string;
    }) => {
      const { data } = await api.post<ApiResponse<Message>>(
        `/organizations/${orgId}/conversations/${conversationId}/messages`,
        { content },
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: conversationKeys.messages(orgId, variables.conversationId),
        });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useUploadFile - mutation
// ---------------------------------------------------------------------------

export function useUploadFile() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      file,
    }: {
      conversationId: string;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<ApiResponse<Message>>(
        `/organizations/${orgId}/conversations/${conversationId}/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: conversationKeys.messages(orgId, variables.conversationId),
        });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useHandoff - mutation
// ---------------------------------------------------------------------------

export function useHandoff() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId }: { conversationId: string }) => {
      const { data } = await api.post<ApiResponse<Conversation>>(
        `/organizations/${orgId}/conversations/${conversationId}/handoff`,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: conversationKeys.detail(orgId, variables.conversationId),
        });
        queryClient.invalidateQueries({
          queryKey: conversationKeys.all(orgId),
        });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useResolve - mutation
// ---------------------------------------------------------------------------

export function useResolve() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId }: { conversationId: string }) => {
      const { data } = await api.post<ApiResponse<Conversation>>(
        `/organizations/${orgId}/conversations/${conversationId}/resolve`,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: conversationKeys.detail(orgId, variables.conversationId),
        });
        queryClient.invalidateQueries({
          queryKey: conversationKeys.all(orgId),
        });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useReturnToAI - mutation
// ---------------------------------------------------------------------------

export function useReturnToAI() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId }: { conversationId: string }) => {
      const { data } = await api.post<ApiResponse<Conversation>>(
        `/organizations/${orgId}/conversations/${conversationId}/return-to-ai`,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: conversationKeys.detail(orgId, variables.conversationId),
        });
        queryClient.invalidateQueries({
          queryKey: conversationKeys.all(orgId),
        });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteConversation - mutation
// ---------------------------------------------------------------------------

export function useDeleteConversation() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId }: { conversationId: string }) => {
      const { data } = await api.delete<ApiResponse<null>>(
        `/organizations/${orgId}/conversations/${conversationId}`,
      );
      return data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: conversationKeys.all(orgId),
        });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Conversation Notes
// ---------------------------------------------------------------------------

export interface ConversationNote {
  id: string;
  conversationId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export const noteKeys = {
  all: (orgId: string, convId: string) =>
    [...conversationKeys.detail(orgId, convId), 'notes'] as const,
};

export function useConversationNotes(conversationId: string | null) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: noteKeys.all(orgId!, conversationId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ConversationNote[]>>(
        `/organizations/${orgId}/conversations/${conversationId}/notes`,
      );
      return data.data;
    },
    enabled: !!orgId && !!conversationId,
  });
}

export function useCreateNote() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: string;
    }) => {
      const { data } = await api.post<ApiResponse<ConversationNote>>(
        `/organizations/${orgId}/conversations/${conversationId}/notes`,
        { content },
      );
      return data.data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: noteKeys.all(orgId, variables.conversationId),
        });
      }
    },
  });
}

export function useUpdateNote() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      noteId,
      content,
    }: {
      conversationId: string;
      noteId: string;
      content: string;
    }) => {
      const { data } = await api.patch<ApiResponse<ConversationNote>>(
        `/organizations/${orgId}/conversations/${conversationId}/notes/${noteId}`,
        { content },
      );
      return data.data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: noteKeys.all(orgId, variables.conversationId),
        });
      }
    },
  });
}

export function useDeleteNote() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      noteId,
    }: {
      conversationId: string;
      noteId: string;
    }) => {
      await api.delete(
        `/organizations/${orgId}/conversations/${conversationId}/notes/${noteId}`,
      );
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: noteKeys.all(orgId, variables.conversationId),
        });
      }
    },
  });
}
