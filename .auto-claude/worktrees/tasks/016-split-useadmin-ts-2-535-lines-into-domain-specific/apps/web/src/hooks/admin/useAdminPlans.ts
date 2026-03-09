'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminPlanKeys = {
  plans: ['admin', 'plans'] as const,
  plan: (id: string) => ['admin', 'plans', id] as const,
  planAnalytics: ['admin', 'plan-analytics'] as const,
};

// ---------------------------------------------------------------------------
// Plan Hooks
// ---------------------------------------------------------------------------

/**
 * Get all subscription plans available in the system.
 * Admin-only endpoint for viewing and managing all subscription plans.
 */
export function useAdminPlans() {
  return useQuery({
    queryKey: adminPlanKeys.plans,
    queryFn: async () => {
      const { data } = await api.get('/admin/plans');
      return data.data;
    },
  });
}

/**
 * Get a specific subscription plan by ID.
 * Returns detailed information about a single plan including features and pricing.
 */
export function useAdminPlan(id: string) {
  return useQuery({
    queryKey: adminPlanKeys.plan(id),
    queryFn: async () => {
      const { data } = await api.get(`/admin/plans/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

/**
 * Create a new subscription plan.
 * Admin can create new plans with custom pricing and features.
 */
export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      description?: string;
      price?: number;
      currency?: string;
      interval?: string;
      features?: string[];
      isActive?: boolean;
    }) => {
      const { data } = await api.post('/admin/plans', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminPlanKeys.plans });
    },
  });
}

/**
 * Update an existing subscription plan.
 * Admin can modify plan details, pricing, features, and availability.
 */
export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: {
      id: string;
      name?: string;
      description?: string;
      price?: number;
      currency?: string;
      interval?: string;
      features?: string[];
      isActive?: boolean;
    }) => {
      const { data } = await api.patch(`/admin/plans/${id}`, body);
      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: adminPlanKeys.plans });
      queryClient.invalidateQueries({ queryKey: adminPlanKeys.plan(variables.id) });
    },
  });
}

/**
 * Delete a subscription plan.
 * Admin can remove plans that are no longer offered.
 */
export function useDeletePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/plans/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminPlanKeys.plans });
    },
  });
}

/**
 * Toggle plan active status.
 * Admin can enable or disable plans without deleting them.
 */
export function useTogglePlanStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { data } = await api.patch(`/admin/plans/${id}/toggle-status`, { isActive });
      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: adminPlanKeys.plans });
      queryClient.invalidateQueries({ queryKey: adminPlanKeys.plan(variables.id) });
    },
  });
}

/**
 * Get analytics for subscription plans.
 * Provides insights on plan popularity, revenue, and subscriber counts.
 */
export function useAdminPlanAnalytics() {
  return useQuery({
    queryKey: adminPlanKeys.planAnalytics,
    queryFn: async () => {
      const { data } = await api.get('/admin/plans/analytics');
      return data.data;
    },
  });
}
