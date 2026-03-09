'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminNotificationKeys = {
  all: (params?: Record<string, unknown>) => ['admin', 'notifications', params] as const,
  unreadCount: ['admin', 'notifications', 'unread-count'] as const,
  settings: ['admin', 'notification-settings'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * List all notifications across the platform with pagination.
 * Admin-only endpoint for viewing all user notifications.
 */
export function useAdminNotifications(params: {
  page: number;
  limit: number;
  userId?: string;
  orgId?: string;
  type?: string;
  isRead?: boolean;
}) {
  return useQuery({
    queryKey: adminNotificationKeys.all(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.userId) searchParams.set('userId', params.userId);
      if (params.orgId) searchParams.set('orgId', params.orgId);
      if (params.type) searchParams.set('type', params.type);
      if (params.isRead !== undefined) searchParams.set('isRead', String(params.isRead));
      const { data } = await api.get(`/admin/notifications?${searchParams}`);
      return data.data;
    },
  });
}

/**
 * Get platform-wide unread notification count.
 * Admin-only endpoint for monitoring unread notifications.
 */
export function useAdminUnreadCount() {
  return useQuery({
    queryKey: adminNotificationKeys.unreadCount,
    queryFn: async () => {
      const { data } = await api.get('/admin/notifications/unread-count');
      return data.data;
    },
    refetchInterval: 30000,
  });
}

/**
 * Send notification to specific user(s).
 * Admin-only endpoint for creating notifications.
 */
export function useSendNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      userId?: string;
      orgId?: string;
      type: string;
      title: string;
      body: string;
      metadata?: Record<string, any>;
    }) => {
      const { data } = await api.post('/admin/notifications', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: adminNotificationKeys.unreadCount });
    },
  });
}

/**
 * Mark a notification as read.
 * Admin-only endpoint for managing notification read status.
 */
export function useAdminMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data } = await api.patch(`/admin/notifications/${notificationId}/read`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: adminNotificationKeys.unreadCount });
    },
  });
}

/**
 * Mark all notifications as read for a user or organization.
 * Admin-only endpoint for bulk read marking.
 */
export function useAdminMarkAllAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { userId?: string; orgId?: string }) => {
      const searchParams = new URLSearchParams();
      if (params.userId) searchParams.set('userId', params.userId);
      if (params.orgId) searchParams.set('orgId', params.orgId);
      const { data } = await api.post(`/admin/notifications/mark-all-read?${searchParams}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: adminNotificationKeys.unreadCount });
    },
  });
}

/**
 * Delete a notification.
 * Admin-only endpoint for removing notifications.
 */
export function useDeleteAdminNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data } = await api.delete(`/admin/notifications/${notificationId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: adminNotificationKeys.unreadCount });
    },
  });
}

/**
 * Bulk delete notifications.
 * Admin-only endpoint for bulk deletion.
 */
export function useBulkDeleteNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const { data } = await api.post('/admin/notifications/bulk-delete', { notificationIds });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: adminNotificationKeys.unreadCount });
    },
  });
}

/**
 * Get platform notification settings.
 * Admin-only endpoint for viewing notification configuration.
 */
export function useAdminNotificationSettings() {
  return useQuery({
    queryKey: adminNotificationKeys.settings,
    queryFn: async () => {
      const { data } = await api.get('/admin/notification-settings');
      return data.data;
    },
  });
}

/**
 * Update platform notification settings.
 * Admin-only endpoint for configuring notification defaults.
 */
export function useUpdateAdminNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Record<string, any>) => {
      const { data } = await api.patch('/admin/notification-settings', settings);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminNotificationKeys.settings });
    },
  });
}
