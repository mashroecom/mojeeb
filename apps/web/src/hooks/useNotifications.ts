'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export interface NotificationPreferences {
  id: string;
  emailNewConversation: boolean;
  emailHandoff: boolean;
  emailLeadExtracted: boolean;
  emailUsageWarning: boolean;
  emailWeeklyDigest: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiResponse<T> {
  success: true;
  data: T;
  pagination?: Pagination;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const notificationKeys = {
  all: (orgId: string) => ['organizations', orgId, 'notifications'] as const,
  unreadCount: (orgId: string) =>
    ['organizations', orgId, 'notifications', 'unread-count'] as const,
  preferences: (orgId: string) =>
    ['organizations', orgId, 'notifications', 'preferences'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * List notifications for the current user in the current organization (paginated).
 */
export function useNotifications(params?: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}) {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: [
      ...notificationKeys.all(orgId!),
      params?.page,
      params?.limit,
      params?.unreadOnly,
    ],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.unreadOnly) searchParams.set('unreadOnly', 'true');

      const qs = searchParams.toString();
      const url = `/organizations/${orgId}/notifications${qs ? `?${qs}` : ''}`;
      const { data } = await api.get<ApiResponse<Notification[]>>(url);
      return { data: data.data, pagination: data.pagination! };
    },
    enabled: !!orgId,
  });
}

/**
 * Get unread notification count. Polls every 30 seconds.
 */
export function useUnreadCount() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: notificationKeys.unreadCount(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ count: number }>>(
        `/organizations/${orgId}/notifications/unread-count`,
      );
      return data.data.count;
    },
    enabled: !!orgId,
    refetchInterval: 30000,
  });
}

/**
 * Mark a single notification as read.
 */
export function useMarkAsRead() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.patch(
        `/organizations/${orgId}/notifications/${notificationId}/read`,
      );
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: notificationKeys.all(orgId),
        });
        queryClient.invalidateQueries({
          queryKey: notificationKeys.unreadCount(orgId),
        });
      }
    },
  });
}

/**
 * Mark all notifications as read for the current organization.
 */
export function useMarkAllAsRead() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post(
        `/organizations/${orgId}/notifications/mark-all-read`,
      );
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: notificationKeys.all(orgId),
        });
        queryClient.invalidateQueries({
          queryKey: notificationKeys.unreadCount(orgId),
        });
      }
    },
  });
}

/**
 * Delete a notification.
 */
export function useDeleteNotification() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.delete(
        `/organizations/${orgId}/notifications/${notificationId}`,
      );
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: notificationKeys.all(orgId),
        });
        queryClient.invalidateQueries({
          queryKey: notificationKeys.unreadCount(orgId),
        });
      }
    },
  });
}

/**
 * Get notification preferences for the current user.
 */
export function useNotificationPreferences() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: notificationKeys.preferences(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<NotificationPreferences>>(
        `/organizations/${orgId}/notifications/preferences`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}

/**
 * Update notification preferences.
 */
export function useUpdateNotificationPreferences() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefs: Partial<Omit<NotificationPreferences, 'id'>>) => {
      const { data } = await api.put<ApiResponse<NotificationPreferences>>(
        `/organizations/${orgId}/notifications/preferences`,
        prefs,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: notificationKeys.preferences(orgId),
        });
      }
    },
  });
}
