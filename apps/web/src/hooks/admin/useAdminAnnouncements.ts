'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminAnnouncementKeys = {
  all: (params?: Record<string, unknown>) => ['admin', 'announcements', params] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * List all announcements with pagination.
 * Admin-only endpoint for managing platform-wide announcements.
 */
export function useAdminAnnouncements(params: { page: number; limit: number }) {
  return useQuery({
    queryKey: adminAnnouncementKeys.all(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      const { data } = await api.get(`/admin/announcements?${searchParams}`);
      return data.data;
    },
  });
}

/**
 * Create a new announcement.
 * Invalidates the announcements list on success.
 */
export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; body: string; type?: string; startsAt?: string; endsAt?: string }) => {
      const { data } = await api.post('/admin/announcements', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
  });
}

/**
 * Update an existing announcement.
 * Invalidates the announcements list on success.
 */
export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; title?: string; body?: string; type?: string; isActive?: boolean }) => {
      const { data } = await api.patch(`/admin/announcements/${id}`, body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
  });
}

/**
 * Delete an announcement.
 * Invalidates the announcements list on success.
 */
export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/announcements/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
  });
}
