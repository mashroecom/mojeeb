'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminFileKeys = {
  fileManager: (params?: Record<string, unknown>) => ['admin', 'file-manager', params] as const,
  fileStats: ['admin', 'file-stats'] as const,
};

// ---------------------------------------------------------------------------
// File Manager Hooks
// ---------------------------------------------------------------------------

/**
 * Get files from the file manager with pagination and filtering.
 * Admin-only endpoint for managing uploaded files and storage.
 */
export function useAdminFileManager(params: { page: number; limit: number; search?: string; type?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: adminFileKeys.fileManager(params),
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
      if (params.search) sp.set('search', params.search);
      if (params.type) sp.set('type', params.type);
      if (params.startDate) sp.set('startDate', params.startDate);
      if (params.endDate) sp.set('endDate', params.endDate);
      const { data } = await api.get(`/admin/file-manager?${sp}`);
      return data.data;
    },
  });
}

/**
 * Get file storage statistics and usage metrics.
 * Provides insights on storage usage, file types, and storage trends.
 */
export function useAdminFileStats() {
  return useQuery({
    queryKey: adminFileKeys.fileStats,
    queryFn: async () => {
      const { data } = await api.get('/admin/file-manager/stats');
      return data.data;
    },
  });
}

/**
 * Delete a file from the file manager.
 * Admin can remove files to clean up storage or remove inappropriate content.
 */
export function useDeleteAdminFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/file-manager/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'file-manager'] });
      queryClient.invalidateQueries({ queryKey: adminFileKeys.fileStats });
    },
  });
}
