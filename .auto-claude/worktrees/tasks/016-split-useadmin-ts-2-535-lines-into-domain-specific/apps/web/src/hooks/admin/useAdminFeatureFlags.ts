'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminFeatureFlagKeys = {
  featureFlags: ['admin', 'feature-flags'] as const,
  featureFlag: (id: string) => ['admin', 'feature-flags', id] as const,
};

// ---------------------------------------------------------------------------
// Feature Flag Hooks
// ---------------------------------------------------------------------------

/**
 * Get all feature flags in the system.
 * Admin-only endpoint for viewing and managing all feature flags.
 */
export function useAdminFeatureFlags() {
  return useQuery({
    queryKey: adminFeatureFlagKeys.featureFlags,
    queryFn: async () => {
      const { data } = await api.get('/admin/feature-flags');
      return data.data;
    },
  });
}

/**
 * Get a specific feature flag by ID.
 * Returns detailed information about a single feature flag including status and configuration.
 */
export function useAdminFeatureFlag(id: string) {
  return useQuery({
    queryKey: adminFeatureFlagKeys.featureFlag(id),
    queryFn: async () => {
      const { data } = await api.get(`/admin/feature-flags/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

/**
 * Create a new feature flag.
 * Admin can create new feature flags with custom configuration.
 */
export function useCreateFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      key: string;
      name: string;
      description?: string;
      enabled?: boolean;
      value?: unknown;
      metadata?: Record<string, unknown>;
    }) => {
      const { data } = await api.post('/admin/feature-flags', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminFeatureFlagKeys.featureFlags });
    },
  });
}

/**
 * Update an existing feature flag.
 * Admin can modify feature flag details, configuration, and status.
 */
export function useUpdateAdminFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: {
      id: string;
      key?: string;
      name?: string;
      description?: string;
      enabled?: boolean;
      value?: unknown;
      metadata?: Record<string, unknown>;
    }) => {
      const { data } = await api.patch(`/admin/feature-flags/${id}`, body);
      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: adminFeatureFlagKeys.featureFlags });
      queryClient.invalidateQueries({ queryKey: adminFeatureFlagKeys.featureFlag(variables.id) });
    },
  });
}

/**
 * Delete a feature flag.
 * Admin can remove feature flags that are no longer needed.
 */
export function useDeleteFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/feature-flags/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminFeatureFlagKeys.featureFlags });
    },
  });
}

/**
 * Toggle feature flag enabled status.
 * Admin can quickly enable or disable feature flags without editing other properties.
 */
export function useToggleAdminFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { data } = await api.patch(`/admin/feature-flags/${id}/toggle`, { enabled });
      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: adminFeatureFlagKeys.featureFlags });
      queryClient.invalidateQueries({ queryKey: adminFeatureFlagKeys.featureFlag(variables.id) });
    },
  });
}
