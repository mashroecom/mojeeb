'use client';

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminConversation {
  id: string;
  customerId: string;
  customerName: string | null;
  organizationId: string;
  organizationName?: string;
  status: 'ACTIVE' | 'HANDED_OFF' | 'WAITING' | 'RESOLVED' | 'ARCHIVED';
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

export interface AdminMessage {
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
// Query keys
// ---------------------------------------------------------------------------

export const adminConversationKeys = {
  all: (params?: Record<string, unknown>) => ['admin', 'conversations', params] as const,
  detail: (id: string) => ['admin', 'conversations', id] as const,
  stats: ['admin', 'conversations-stats'] as const,
  messages: (conversationId: string, params?: Record<string, unknown>) =>
    ['admin', 'conversations', conversationId, 'messages', params] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * List all conversations across all organizations with pagination and filtering.
 * Admin-only endpoint.
 */
export function useAdminConversations(params: {
  page: number;
  limit: number;
  search?: string;
  orgId?: string;
  status?: AdminConversation['status'];
  channelId?: string;
}) {
  return useQuery({
    queryKey: adminConversationKeys.all(params),
    queryFn: async () => {
      const sp = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.search) sp.set('search', params.search);
      if (params.orgId) sp.set('orgId', params.orgId);
      if (params.status) sp.set('status', params.status);
      if (params.channelId) sp.set('channelId', params.channelId);
      const { data } = await api.get(`/admin/conversations?${sp}`);
      return data.data;
    },
  });
}

/**
 * Get a single conversation by ID.
 * Admin-only endpoint - can view any conversation across all organizations.
 */
export function useAdminConversationDetail(conversationId: string) {
  return useQuery({
    queryKey: adminConversationKeys.detail(conversationId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/conversations/${conversationId}`);
      return data.data;
    },
    enabled: !!conversationId,
  });
}

/**
 * Get platform-wide conversation statistics.
 * Admin-only endpoint.
 */
export function useAdminConversationStats() {
  return useQuery({
    queryKey: adminConversationKeys.stats,
    queryFn: async () => {
      const { data } = await api.get('/admin/conversations/stats');
      return data.data;
    },
  });
}

/**
 * Get messages for a specific conversation with infinite scroll pagination.
 * Admin-only endpoint - can view messages from any conversation.
 */
export function useAdminConversationMessages(conversationId: string, params?: { limit?: number }) {
  return useInfiniteQuery({
    queryKey: adminConversationKeys.messages(conversationId, params),
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get<ApiResponse<AdminMessage[]>>(
        `/admin/conversations/${conversationId}/messages`,
        { params: { page: pageParam, limit: params?.limit || 50 } },
      );
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination) return undefined;
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    enabled: !!conversationId,
  });
}

/**
 * Update a conversation as admin.
 * Invalidates the conversations list and detail on success.
 */
export function useUpdateAdminConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      ...body
    }: {
      conversationId: string;
      [key: string]: unknown;
    }) => {
      const { data } = await api.patch(`/admin/conversations/${conversationId}`, body);
      return data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'conversations'] });
      queryClient.invalidateQueries({
        queryKey: adminConversationKeys.detail(variables.conversationId),
      });
    },
  });
}

/**
 * Delete a conversation as admin.
 * Invalidates the conversations list on success.
 */
export function useDeleteAdminConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data } = await api.delete(`/admin/conversations/${conversationId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'conversations'] });
    },
  });
}

/**
 * Assign a conversation to a specific user as admin.
 * Invalidates the conversation detail on success.
 */
export function useAdminAssignConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      const { data } = await api.post(`/admin/conversations/${conversationId}/assign`, { userId });
      return data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminConversationKeys.detail(variables.conversationId),
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'conversations'] });
    },
  });
}

/**
 * Update conversation status as admin.
 * Invalidates the conversation detail on success.
 */
export function useAdminUpdateConversationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      status,
    }: {
      conversationId: string;
      status: AdminConversation['status'];
    }) => {
      const { data } = await api.patch(`/admin/conversations/${conversationId}/status`, { status });
      return data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminConversationKeys.detail(variables.conversationId),
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'conversations'] });
    },
  });
}
