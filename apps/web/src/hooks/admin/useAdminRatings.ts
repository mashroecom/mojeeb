'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminRatingKeys = {
  all: (params?: Record<string, unknown>) => ['admin', 'ratings', params] as const,
  stats: ['admin', 'rating-stats'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * List all ratings/CSAT scores across all organizations with pagination and filtering.
 * Admin-only endpoint.
 */
export function useAdminRatings(params: {
  page: number;
  limit: number;
  search?: string;
  score?: string;
  conversationId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: adminRatingKeys.all(params),
    queryFn: async () => {
      const sp = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.search) sp.set('search', params.search);
      if (params.score) sp.set('score', params.score);
      if (params.conversationId) sp.set('conversationId', params.conversationId);
      if (params.userId) sp.set('userId', params.userId);
      if (params.startDate) sp.set('startDate', params.startDate);
      if (params.endDate) sp.set('endDate', params.endDate);
      const { data } = await api.get(`/admin/ratings?${sp}`);
      return data.data;
    },
  });
}

/**
 * Get platform-wide rating statistics.
 * Admin-only endpoint.
 */
export function useAdminRatingStats() {
  return useQuery({
    queryKey: adminRatingKeys.stats,
    queryFn: async () => {
      const { data } = await api.get('/admin/ratings/stats');
      return data.data;
    },
  });
}

/**
 * Delete a rating as admin.
 * Invalidates the ratings list and stats on success.
 */
export function useDeleteRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ratingId: string) => {
      const { data } = await api.delete(`/admin/ratings/${ratingId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ratings'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'rating-stats'] });
    },
  });
}

/**
 * Bulk delete multiple ratings.
 * Admin-only endpoint for batch operations.
 */
export function useBulkDeleteRatings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ratingIds: string[]) => {
      const { data } = await api.post('/admin/ratings/bulk-delete', { ratingIds });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ratings'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'rating-stats'] });
    },
  });
}
