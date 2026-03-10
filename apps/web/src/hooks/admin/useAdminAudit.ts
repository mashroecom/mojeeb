'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const adminAuditKeys = {
  auditLog: (params?: object) => ['admin', 'audit-log', params] as const,
  loginActivity: (params?: Record<string, unknown>) => ['admin', 'login-activity', params] as const,
  loginActivityStats: ['admin', 'login-activity-stats'] as const,
  blockedIPs: (params?: Record<string, unknown>) => ['admin', 'blocked-ips', params] as const,
  sessions: (params?: Record<string, unknown>) => ['admin', 'sessions', params] as const,
  sessionStats: ['admin', 'session-stats'] as const,
  securitySettings: ['admin', 'security-settings'] as const,
};

// Audit Log
export function useAdminAuditLog(params: {
  page: number;
  limit: number;
  action?: string;
  targetType?: string;
  userId?: string;
  targetId?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: adminAuditKeys.auditLog(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.action) searchParams.set('action', params.action);
      if (params.targetType) searchParams.set('targetType', params.targetType);
      if (params.userId) searchParams.set('userId', params.userId);
      if (params.targetId) searchParams.set('targetId', params.targetId);
      if (params.startDate) searchParams.set('startDate', params.startDate);
      if (params.endDate) searchParams.set('endDate', params.endDate);
      const { data } = await api.get(`/admin/audit-log?${searchParams}`);
      return data.data;
    },
  });
}

// ===== Login Activity =====
export function useAdminLoginActivity(params: {
  page: number;
  limit: number;
  email?: string;
  ip?: string;
  success?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: adminAuditKeys.loginActivity(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.email) searchParams.set('email', params.email);
      if (params.ip) searchParams.set('ip', params.ip);
      if (params.success) searchParams.set('success', params.success);
      if (params.startDate) searchParams.set('startDate', params.startDate);
      if (params.endDate) searchParams.set('endDate', params.endDate);
      const { data } = await api.get(`/admin/login-activity?${searchParams}`);
      return data.data;
    },
  });
}

export function useAdminLoginActivityStats() {
  return useQuery({
    queryKey: adminAuditKeys.loginActivityStats,
    queryFn: async () => {
      const { data } = await api.get('/admin/login-activity/stats');
      return data.data;
    },
    refetchInterval: 30000,
  });
}

// ===== Blocked IPs =====
export function useAdminBlockedIPs(params: { page: number; limit: number }) {
  return useQuery({
    queryKey: adminAuditKeys.blockedIPs(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      const { data } = await api.get(`/admin/blocked-ips?${searchParams}`);
      return data.data;
    },
  });
}

export function useBlockIP() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { ip: string; reason: string; expiresAt?: string }) => {
      const { data } = await api.post('/admin/blocked-ips', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'blocked-ips'] });
    },
  });
}

export function useUnblockIP() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/blocked-ips/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'blocked-ips'] });
    },
  });
}

// ===== Sessions =====
export function useAdminSessions(params: { page: number; limit: number; email?: string }) {
  return useQuery({
    queryKey: adminAuditKeys.sessions(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.email) searchParams.set('email', params.email);
      const { data } = await api.get(`/admin/sessions?${searchParams}`);
      return data.data;
    },
  });
}

export function useAdminSessionStats() {
  return useQuery({
    queryKey: adminAuditKeys.sessionStats,
    queryFn: async () => {
      const { data } = await api.get('/admin/sessions/stats');
      return data.data;
    },
    refetchInterval: 30000,
  });
}

export function useKillSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/sessions/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sessions'] });
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

// ===== Security Settings =====
export function useAdminSecuritySettings() {
  return useQuery({
    queryKey: adminAuditKeys.securitySettings,
    queryFn: async () => {
      const { data } = await api.get('/admin/security-settings');
      return data.data;
    },
  });
}

export function useUpdateSecuritySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      const { data } = await api.patch('/admin/security-settings', { settings });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAuditKeys.securitySettings });
    },
  });
}
