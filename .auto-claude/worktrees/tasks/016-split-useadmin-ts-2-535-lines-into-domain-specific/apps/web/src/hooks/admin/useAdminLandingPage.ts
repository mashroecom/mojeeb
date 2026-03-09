'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminLandingPageKeys = {
  landingPage: ['admin', 'landing-page'] as const,
};

// ---------------------------------------------------------------------------
// Landing Page CMS Hooks
// ---------------------------------------------------------------------------

/**
 * Get landing page content and configuration.
 * Admin-only endpoint for managing landing page CMS content.
 */
export function useAdminLandingPage() {
  return useQuery({
    queryKey: adminLandingPageKeys.landingPage,
    queryFn: async () => {
      const { data } = await api.get('/admin/landing-page');
      return data.data;
    },
  });
}

/**
 * Update landing page content and configuration.
 * Admin can modify landing page sections, hero content, features, testimonials, etc.
 */
export function useUpdateAdminLandingPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      hero_title?: string;
      hero_subtitle?: string;
      hero_cta_text?: string;
      hero_cta_link?: string;
      features?: unknown[];
      testimonials?: unknown[];
      faq?: unknown[];
      metadata?: Record<string, unknown>;
    }) => {
      const { data } = await api.patch('/admin/landing-page', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminLandingPageKeys.landingPage });
    },
  });
}
