'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const adminUserKeys = {
  users: (params?: object) => ['admin', 'users', params] as const,
  userDetail: (userId: string) => ['admin', 'users', userId] as const,
  userApiKeys: (userId: string, page: number, limit: number) => ['admin', 'users', userId, 'api-keys', page, limit] as const,
  userConversations: (userId: string, page: number, limit: number) => ['admin', 'users', userId, 'conversations', page, limit] as const,
  userLeads: (userId: string, page: number, limit: number) => ['admin', 'users', userId, 'leads', page, limit] as const,
  userNotifications: (userId: string, page: number, limit: number) => ['admin', 'users', userId, 'notifications', page, limit] as const,
  userActions: (userId: string, page: number, limit: number) => ['admin', 'users', userId, 'actions', page, limit] as const,
};

// ===== User Management =====

export function useAdminUsers(params: { page: number; limit: number; search?: string; status?: string }) {
  return useQuery({
    queryKey: adminUserKeys.users(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.search) searchParams.set('search', params.search);
      if (params.status) searchParams.set('status', params.status);
      const { data } = await api.get(`/admin/users?${searchParams}`);
      return data.data;
    },
  });
}

export function useAdminUserDetail(userId: string) {
  return useQuery({
    queryKey: adminUserKeys.userDetail(userId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/users/${userId}`);
      return data.data;
    },
    enabled: !!userId,
  });
}

export function useAdminUserApiKeys(userId: string, page = 1, limit = 10) {
  return useQuery({
    queryKey: adminUserKeys.userApiKeys(userId, page, limit),
    queryFn: () => api.get(`/admin/users/${userId}/api-keys?page=${page}&limit=${limit}`).then(r => r.data.data),
    enabled: !!userId,
  });
}

export function useAdminUserConversations(userId: string, page = 1, limit = 10) {
  return useQuery({
    queryKey: adminUserKeys.userConversations(userId, page, limit),
    queryFn: () => api.get(`/admin/users/${userId}/conversations?page=${page}&limit=${limit}`).then(r => r.data.data),
    enabled: !!userId,
  });
}

export function useAdminUserLeads(userId: string, page = 1, limit = 10) {
  return useQuery({
    queryKey: adminUserKeys.userLeads(userId, page, limit),
    queryFn: () => api.get(`/admin/users/${userId}/leads?page=${page}&limit=${limit}`).then(r => r.data.data),
    enabled: !!userId,
  });
}

export function useAdminUserNotifications(userId: string, page = 1, limit = 10) {
  return useQuery({
    queryKey: adminUserKeys.userNotifications(userId, page, limit),
    queryFn: () => api.get(`/admin/users/${userId}/notifications?page=${page}&limit=${limit}`).then(r => r.data.data),
    enabled: !!userId,
  });
}

export function useAdminUserActions(userId: string, page = 1, limit = 10) {
  return useQuery({
    queryKey: adminUserKeys.userActions(userId, page, limit),
    queryFn: () => api.get(`/admin/audit-log?userId=${userId}&page=${page}&limit=${limit}`).then(r => r.data.data),
    enabled: !!userId,
  });
}

export function useToggleUserSuspension() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.patch(`/admin/users/${userId}/suspend`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.delete(`/admin/users/${userId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useBulkSuspendUsers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const { data } = await api.post('/admin/users/bulk-suspend', { userIds });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useBulkDeleteUsers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const { data } = await api.post('/admin/users/bulk-delete', { userIds });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useBulkUnsuspendUsers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const { data } = await api.post('/admin/users/bulk-unsuspend', { userIds });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useToggleSuperAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.patch(`/admin/users/${userId}/toggle-superadmin`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.post(`/admin/users/${userId}/reset-password`);
      return data.data;
    },
  });
}

export function useSendUserEmail() {
  return useMutation({
    mutationFn: async ({ userId, subject, body: emailBody }: { userId: string; subject: string; body: string }) => {
      const { data } = await api.post(`/admin/users/${userId}/send-email`, { subject, body: emailBody });
      return data.data;
    },
  });
}

export function useImpersonateUser() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.post(`/admin/users/${userId}/impersonate`);
      return data.data;
    },
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, ...updates }: { userId: string; firstName?: string; lastName?: string; email?: string; newPassword?: string }) => {
      const { data } = await api.patch(`/admin/users/${userId}/profile`, updates);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useVerifyUserEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.post(`/admin/users/${userId}/verify-email`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useKillUserSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.delete(`/admin/sessions/user/${userId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sessions'] });
    },
  });
}
