'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminTemplateKeys = {
  messageTemplatesAdmin: (params?: Record<string, unknown>) => ['admin', 'message-templates-admin', params] as const,
  messageTemplateAnalytics: ['admin', 'message-template-analytics'] as const,
  tagsAdmin: (params?: Record<string, unknown>) => ['admin', 'tags-admin', params] as const,
};

// ---------------------------------------------------------------------------
// Message Template Hooks
// ---------------------------------------------------------------------------

/**
 * List all message templates across the platform with pagination.
 * Admin-only endpoint for viewing all organization message templates.
 */
export function useAdminMessageTemplates(params: { page: number; limit: number; search?: string; category?: string }) {
  return useQuery({
    queryKey: adminTemplateKeys.messageTemplatesAdmin(params),
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
      if (params.search) sp.set('search', params.search);
      if (params.category) sp.set('category', params.category);
      const { data } = await api.get(`/admin/message-templates-admin?${sp}`);
      return data.data;
    },
  });
}

/**
 * Create a new message template.
 * Admin can create templates for any organization.
 */
export function useCreateMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; content: string; category?: string; shortcut?: string; orgId?: string }) => {
      const { data } = await api.post('/admin/message-templates-admin', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'message-templates-admin'] });
    },
  });
}

/**
 * Update an existing message template.
 * Admin can modify templates for any organization.
 */
export function useUpdateMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; title?: string; content?: string; category?: string; shortcut?: string; orgId?: string }) => {
      const { data } = await api.patch(`/admin/message-templates-admin/${id}`, body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'message-templates-admin'] });
    },
  });
}

/**
 * Delete a message template.
 * Admin can delete templates from any organization.
 */
export function useDeleteMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/message-templates-admin/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'message-templates-admin'] });
    },
  });
}

/**
 * Get analytics for message template usage across the platform.
 * Provides insights on most-used templates, categories, etc.
 */
export function useAdminMessageTemplateAnalytics() {
  return useQuery({
    queryKey: adminTemplateKeys.messageTemplateAnalytics,
    queryFn: async () => {
      const { data } = await api.get('/admin/message-templates/analytics');
      return data.data;
    },
  });
}

// ---------------------------------------------------------------------------
// Tag Hooks
// ---------------------------------------------------------------------------

/**
 * List all tags across the platform with pagination.
 * Admin-only endpoint for viewing all conversation tags.
 */
export function useAdminTags(params: { page: number; limit: number; search?: string }) {
  return useQuery({
    queryKey: adminTemplateKeys.tagsAdmin(params),
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
      if (params.search) sp.set('search', params.search);
      const { data } = await api.get(`/admin/tags?${sp}`);
      return data.data;
    },
  });
}

/**
 * Delete a tag from the platform.
 * Admin can remove tags from any organization.
 */
export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/tags/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tags-admin'] });
    },
  });
}
