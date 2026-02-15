'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KBDocument {
  id: string;
  title: string;
  content: string;
  contentType: 'TEXT' | 'FAQ' | 'PDF' | 'URL';
  sourceUrl: string | null;
  embeddingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  chunkCount: number;
  createdAt: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { documents: number };
  documents?: KBDocument[];
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

// Mutation payloads
interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
}

interface UpdateKnowledgeBaseInput {
  kbId: string;
  name?: string;
  description?: string;
}

interface AddDocumentInput {
  kbId: string;
  title: string;
  content?: string;
  contentType?: 'TEXT' | 'FAQ' | 'PDF' | 'URL';
  sourceUrl?: string;
  fileBase64?: string;
}

interface DeleteDocumentInput {
  kbId: string;
  docId: string;
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const knowledgeBaseKeys = {
  all: (orgId: string) => ['organizations', orgId, 'knowledge-bases'] as const,
  detail: (orgId: string, kbId: string) =>
    ['organizations', orgId, 'knowledge-bases', kbId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List all knowledge bases for the current organization.
 */
export function useKnowledgeBases() {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: knowledgeBaseKeys.all(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<KnowledgeBase[]>>(
        `/organizations/${orgId}/knowledge-bases`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}

/**
 * Fetch a single knowledge base by ID.
 */
export function useKnowledgeBase(kbId: string | undefined) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: knowledgeBaseKeys.detail(orgId!, kbId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<KnowledgeBase>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}`,
      );
      return data.data;
    },
    enabled: !!orgId && !!kbId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a new knowledge base. Invalidates the KB list on success.
 */
export function useCreateKnowledgeBase() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async (input: CreateKnowledgeBaseInput) => {
      const { data } = await api.post<ApiResponse<KnowledgeBase>>(
        `/organizations/${orgId}/knowledge-bases`,
        input,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all(orgId) });
      }
    },
  });
}

/**
 * Update a knowledge base (name/description).
 */
export function useUpdateKnowledgeBase() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async ({ kbId, ...body }: UpdateKnowledgeBaseInput) => {
      const { data } = await api.patch<ApiResponse<KnowledgeBase>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}`,
        body,
      );
      return data.data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.detail(orgId, variables.kbId) });
        queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all(orgId) });
      }
    },
  });
}

/**
 * Delete a knowledge base. Invalidates the KB list on success.
 */
export function useDeleteKnowledgeBase() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async (kbId: string) => {
      const { data } = await api.delete<ApiResponse<void>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}`,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all(orgId) });
      }
    },
  });
}

/**
 * Add a document to a knowledge base.
 * Invalidates both the single KB detail and the KB list on success.
 */
export function useAddDocument() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async ({ kbId, ...body }: AddDocumentInput) => {
      const { data } = await api.post<ApiResponse<KBDocument>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}/documents`,
        body,
      );
      return data.data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: knowledgeBaseKeys.detail(orgId, variables.kbId),
        });
        queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all(orgId) });
      }
    },
  });
}

/**
 * Delete a document from a knowledge base.
 * Invalidates both the single KB detail and the KB list on success.
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async ({ kbId, docId }: DeleteDocumentInput) => {
      const { data } = await api.delete<ApiResponse<void>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}/documents/${docId}`,
      );
      return data.data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: knowledgeBaseKeys.detail(orgId, variables.kbId),
        });
        queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all(orgId) });
      }
    },
  });
}
