'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { adminKeys } from '@/hooks/useAdmin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminKBDocument {
  id: string;
  title: string;
  content: string;
  contentType: 'TEXT' | 'FAQ' | 'PDF' | 'URL';
  sourceUrl: string | null;
  embeddingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  chunkCount: number;
  createdAt: string;
}

export interface AdminKnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { documents: number };
  documents?: AdminKBDocument[];
  organization?: {
    id: string;
    name: string;
  };
}

export interface AdminKnowledgeBaseStats {
  total: number;
  totalDocuments: number;
  avgDocumentsPerKB: number;
  embeddingsPending: number;
  embeddingsProcessing: number;
  embeddingsCompleted: number;
  embeddingsFailed: number;
}

interface KnowledgeBasesListResponse {
  items: AdminKnowledgeBase[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Mutation payloads
interface UpdateKnowledgeBaseInput {
  kbId: string;
  name?: string;
  description?: string;
  organizationId?: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List all knowledge bases with admin-level filtering.
 */
export function useAdminKnowledgeBases(params: {
  page: number;
  limit: number;
  search?: string;
  orgId?: string;
}) {
  return useQuery({
    queryKey: adminKeys.knowledgeBases(params),
    queryFn: async () => {
      const sp = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.search) sp.set('search', params.search);
      if (params.orgId) sp.set('orgId', params.orgId);
      const { data } = await api.get<{ success: true; data: KnowledgeBasesListResponse }>(
        `/admin/knowledge-bases?${sp}`,
      );
      return data.data;
    },
  });
}

/**
 * Fetch a single knowledge base by ID (admin view).
 */
export function useAdminKnowledgeBaseDetail(kbId: string) {
  return useQuery({
    queryKey: adminKeys.knowledgeBaseDetail(kbId),
    queryFn: async () => {
      const { data } = await api.get<{ success: true; data: AdminKnowledgeBase }>(
        `/admin/knowledge-bases/${kbId}`,
      );
      return data.data;
    },
    enabled: !!kbId,
  });
}

/**
 * Get knowledge base statistics for admin dashboard.
 */
export function useAdminKnowledgeBaseStats() {
  return useQuery({
    queryKey: adminKeys.knowledgeBaseStats,
    queryFn: async () => {
      const { data } = await api.get<{ success: true; data: AdminKnowledgeBaseStats }>(
        '/admin/knowledge-bases/stats',
      );
      return data.data;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Update a knowledge base (admin). Invalidates queries on success.
 */
export function useUpdateAdminKnowledgeBase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kbId, ...body }: UpdateKnowledgeBaseInput) => {
      const { data } = await api.patch<{ success: true; data: AdminKnowledgeBase }>(
        `/admin/knowledge-bases/${kbId}`,
        body,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge-bases'] });
    },
  });
}

/**
 * Delete a knowledge base (admin). Invalidates queries on success.
 */
export function useDeleteAdminKnowledgeBase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kbId: string) => {
      const { data } = await api.delete<{ success: true; data: void }>(
        `/admin/knowledge-bases/${kbId}`,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge-bases'] });
    },
  });
}
