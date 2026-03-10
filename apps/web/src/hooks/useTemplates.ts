'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const templateKeys = {
  all: ['templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...templateKeys.lists(), params] as const,
  details: () => [...templateKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
  suggestions: (conversationId: string) =>
    [...templateKeys.all, 'suggestions', conversationId] as const,
};

// Template list type
interface Template {
  id: string;
  title: string;
  titleAr?: string | null;
  content: string;
  contentAr?: string | null;
  category: string;
  shortcut?: string | null;
  variables: string[];
  isShared: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

// Template suggestion type
interface TemplateSuggestion {
  template: Template;
  relevance: number;
  reasoning: string;
}

// List templates with filtering
export function useTemplates(params?: { search?: string; category?: string; isShared?: boolean }) {
  return useQuery({
    queryKey: templateKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.category) searchParams.set('category', params.category);
      if (params?.isShared !== undefined) searchParams.set('isShared', String(params.isShared));
      const query = searchParams.toString();
      const { data } = await api.get(`/templates${query ? `?${query}` : ''}`);
      return data.data as Template[];
    },
  });
}

// Get a single template by ID
export function useTemplate(id: string) {
  return useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/templates/${id}`);
      return data.data as Template;
    },
    enabled: !!id,
  });
}

// Get AI-suggested templates based on conversation context
export function useTemplateSuggestions(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: templateKeys.suggestions(conversationId),
    queryFn: async () => {
      const { data } = await api.post('/templates/suggest', { conversationId });
      return data.data as { suggestions: TemplateSuggestion[]; conversationId: string };
    },
    enabled: !!conversationId && enabled,
    staleTime: 30000, // Cache for 30 seconds
  });
}

// Create a new template (admin route)
export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (templateData: {
      title: string;
      titleAr?: string;
      content: string;
      contentAr?: string;
      category: string;
      shortcut?: string;
      isShared: boolean;
    }) => {
      const { data } = await api.post('/admin/message-templates', templateData);
      return data.data as Template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

// Update an existing template (admin route)
export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...templateData
    }: {
      id: string;
      title?: string;
      titleAr?: string;
      content?: string;
      contentAr?: string;
      category?: string;
      shortcut?: string;
      isShared?: boolean;
      isActive?: boolean;
    }) => {
      const { data } = await api.patch(`/admin/message-templates/${id}`, templateData);
      return data.data as Template;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(data.id) });
    },
  });
}

// Delete a template (admin route)
export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/message-templates/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

// Track template usage
export function useTemplateUsage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data } = await api.post(`/templates/${templateId}/use`);
      return data.data as { id: string; usageCount: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(data.id) });
    },
  });
}
