'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const adminKeys = {
  siteSettings: ['admin', 'site-settings'] as const,
  plans: ['admin', 'plans'] as const,
  overview: ['admin', 'overview'] as const,
  growth: (params?: object) => ['admin', 'growth', params] as const,
  users: (params?: object) => ['admin', 'users', params] as const,
  userDetail: (userId: string) => ['admin', 'users', userId] as const,
  orgs: (params?: object) => ['admin', 'organizations', params] as const,
  orgDetail: (orgId: string) => ['admin', 'organizations', orgId] as const,
  orgMembers: (orgId: string) => ['admin', 'organizations', orgId, 'members'] as const,
  subscriptions: (params?: object) => ['admin', 'subscriptions', params] as const,
  subscriptionDetail: (id: string) => ['admin', 'subscriptions', id] as const,
  revenue: ['admin', 'revenue'] as const,
  dailyRevenue: ['admin', 'daily-revenue'] as const,
  topOrgs: ['admin', 'top-organizations'] as const,
  recentActivity: ['admin', 'recent-activity'] as const,
  system: ['admin', 'system'] as const,
  queues: ['admin', 'queues'] as const,
  dbStats: ['admin', 'db-stats'] as const,
  demoRequests: (params?: object) => ['admin', 'demo-requests', params] as const,
  contactMessages: (params?: object) => ['admin', 'contact-messages', params] as const,
  announcements: (params?: object) => ['admin', 'announcements', params] as const,
  auditLog: (params?: object) => ['admin', 'audit-log', params] as const,
  loginActivity: (params?: Record<string, unknown>) => ['admin', 'login-activity', params] as const,
  loginActivityStats: ['admin', 'login-activity-stats'] as const,
  blockedIPs: (params?: Record<string, unknown>) => ['admin', 'blocked-ips', params] as const,
  sessions: (params?: Record<string, unknown>) => ['admin', 'sessions', params] as const,
  sessionStats: ['admin', 'session-stats'] as const,
  featureFlags: ['admin', 'feature-flags'] as const,
  config: ['admin', 'config'] as const,
  configCategory: (cat: string) => ['admin', 'config', cat] as const,
  errorLogs: (params?: Record<string, unknown>) => ['admin', 'error-logs', params] as const,
  webhookLogs: (params?: Record<string, unknown>) => ['admin', 'webhook-logs', params] as const,
  webhookLogStats: ['admin', 'webhook-log-stats'] as const,
  emailTemplates: ['admin', 'email-templates'] as const,
  fileManager: (params?: Record<string, unknown>) => ['admin', 'files', params] as const,
  fileStats: ['admin', 'file-stats'] as const,
  bulkEmail: (params?: Record<string, unknown>) => ['admin', 'bulk-email', params] as const,
  bulkEmailDetail: (id: string) => ['admin', 'bulk-email', id] as const,
  recipientCount: (params?: Record<string, unknown>) => ['admin', 'recipient-count', params] as const,
  notifications: (params?: Record<string, unknown>) => ['admin', 'notifications', params] as const,
  unreadCount: ['admin', 'unread-count'] as const,
  securitySettings: ['admin', 'security-settings'] as const,
  notificationSettings: ['admin', 'notification-settings'] as const,
  orgDefaults: ['admin', 'org-defaults'] as const,
  landingPage: ['admin', 'landing-page'] as const,
  dlq: (params?: Record<string, unknown>) => ['admin', 'dlq', params] as const,
};

// Platform Overview (auto-refresh every 30 seconds)
export function useAdminOverview() {
  return useQuery({
    queryKey: adminKeys.overview,
    queryFn: async () => {
      const { data } = await api.get('/admin/analytics/overview');
      return data.data;
    },
    refetchInterval: 30000,
  });
}

// Platform Growth
export function useAdminGrowth(params?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: adminKeys.growth(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.startDate) searchParams.set('startDate', params.startDate);
      if (params?.endDate) searchParams.set('endDate', params.endDate);
      const query = searchParams.toString();
      const { data } = await api.get(`/admin/analytics/growth${query ? `?${query}` : ''}`);
      return data.data;
    },
  });
}

// Revenue
export function useAdminRevenue() {
  return useQuery({
    queryKey: adminKeys.revenue,
    queryFn: async () => {
      const { data } = await api.get('/admin/analytics/revenue');
      return data.data;
    },
  });
}

// Users
export function useAdminUsers(params: { page: number; limit: number; search?: string; status?: string }) {
  return useQuery({
    queryKey: adminKeys.users(params),
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
    queryKey: adminKeys.userDetail(userId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/users/${userId}`);
      return data.data;
    },
    enabled: !!userId,
  });
}

export function useAdminUserApiKeys(userId: string, page = 1, limit = 10) {
  return useQuery({
    queryKey: ['admin', 'users', userId, 'api-keys', page, limit],
    queryFn: () => api.get(`/admin/users/${userId}/api-keys?page=${page}&limit=${limit}`).then(r => r.data.data),
    enabled: !!userId,
  });
}

export function useAdminUserConversations(userId: string, page = 1, limit = 10) {
  return useQuery({
    queryKey: ['admin', 'users', userId, 'conversations', page, limit],
    queryFn: () => api.get(`/admin/users/${userId}/conversations?page=${page}&limit=${limit}`).then(r => r.data.data),
    enabled: !!userId,
  });
}

export function useAdminUserLeads(userId: string, page = 1, limit = 10) {
  return useQuery({
    queryKey: ['admin', 'users', userId, 'leads', page, limit],
    queryFn: () => api.get(`/admin/users/${userId}/leads?page=${page}&limit=${limit}`).then(r => r.data.data),
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

// Organizations
export function useAdminOrganizations(params: { page: number; limit: number; search?: string; status?: string }) {
  return useQuery({
    queryKey: adminKeys.orgs(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.search) searchParams.set('search', params.search);
      if (params.status) searchParams.set('status', params.status);
      const { data } = await api.get(`/admin/organizations?${searchParams}`);
      return data.data;
    },
  });
}

export function useAdminOrgDetail(orgId: string) {
  return useQuery({
    queryKey: adminKeys.orgDetail(orgId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/organizations/${orgId}`);
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useAdminOrgMembers(orgId: string) {
  return useQuery({
    queryKey: adminKeys.orgMembers(orgId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/organizations/${orgId}/members`);
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useToggleOrgSuspension() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      const { data } = await api.patch(`/admin/organizations/${orgId}/suspend`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      const { data } = await api.delete(`/admin/organizations/${orgId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    },
  });
}

export function useBulkSuspendOrgs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orgIds: string[]) => {
      const { data } = await api.post('/admin/organizations/bulk-suspend', { orgIds });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    },
  });
}

// Subscriptions
export function useAdminSubscriptions(params: { page: number; limit: number; plan?: string; status?: string }) {
  return useQuery({
    queryKey: adminKeys.subscriptions(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.plan) searchParams.set('plan', params.plan);
      if (params.status) searchParams.set('status', params.status);
      const { data } = await api.get(`/admin/subscriptions?${searchParams}`);
      return data.data;
    },
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; plan?: string; messagesLimit?: number; agentsLimit?: number; integrationsLimit?: number }) => {
      const { data } = await api.patch(`/admin/subscriptions/${id}`, body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
    },
  });
}

export function useAdminSubscriptionDetail(id: string) {
  return useQuery({
    queryKey: adminKeys.subscriptionDetail(id),
    queryFn: async () => {
      const { data } = await api.get(`/admin/subscriptions/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

// System Health
export function useSystemHealth() {
  return useQuery({
    queryKey: adminKeys.system,
    queryFn: async () => {
      const { data } = await api.get('/admin/system/health');
      return data.data;
    },
    refetchInterval: 30000,
  });
}

export function useSystemQueues() {
  return useQuery({
    queryKey: adminKeys.queues,
    queryFn: async () => {
      const { data } = await api.get('/admin/system/queues');
      return data.data;
    },
    refetchInterval: 15000,
  });
}

export function useSystemDbStats() {
  return useQuery({
    queryKey: adminKeys.dbStats,
    queryFn: async () => {
      const { data } = await api.get('/admin/system/db-stats');
      return data.data;
    },
  });
}

// Demo Requests
export function useAdminDemoRequests(params: { page: number; limit: number; status?: string }) {
  return useQuery({
    queryKey: adminKeys.demoRequests(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.status) searchParams.set('status', params.status);
      const { data } = await api.get(`/admin/demo-requests?${searchParams}`);
      return data.data;
    },
  });
}

export function useUpdateDemoRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/admin/demo-requests/${id}`, { status });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'demo-requests'] });
    },
  });
}

export function useDeleteDemoRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/demo-requests/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'demo-requests'] });
    },
  });
}

// Contact Messages
export function useAdminContactMessages(params: { page: number; limit: number; status?: string }) {
  return useQuery({
    queryKey: adminKeys.contactMessages(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.status) searchParams.set('status', params.status);
      const { data } = await api.get(`/admin/contact-messages?${searchParams}`);
      return data.data;
    },
  });
}

export function useUpdateContactMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/admin/contact-messages/${id}`, { status });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'contact-messages'] });
    },
  });
}

export function useDeleteContactMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/contact-messages/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'contact-messages'] });
    },
  });
}

// Announcements
export function useAdminAnnouncements(params: { page: number; limit: number }) {
  return useQuery({
    queryKey: adminKeys.announcements(params),
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

// Daily Revenue (last 30 days)
export function useAdminDailyRevenue() {
  return useQuery({
    queryKey: adminKeys.dailyRevenue,
    queryFn: async () => {
      const { data } = await api.get('/admin/analytics/daily-revenue');
      return data.data;
    },
  });
}

// Top Organizations by message count
export function useAdminTopOrgs() {
  return useQuery({
    queryKey: adminKeys.topOrgs,
    queryFn: async () => {
      const { data } = await api.get('/admin/analytics/top-organizations');
      return data.data;
    },
  });
}

// Recent Activity feed
export function useAdminRecentActivity() {
  return useQuery({
    queryKey: adminKeys.recentActivity,
    queryFn: async () => {
      const { data } = await api.get('/admin/analytics/recent-activity');
      return data.data;
    },
  });
}

// ===== Site Settings =====
export function useAdminSiteSettings() {
  return useQuery({
    queryKey: adminKeys.siteSettings,
    queryFn: async () => {
      const { data } = await api.get('/admin/site-settings');
      return data.data;
    },
  });
}

export function useUpdateSiteSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.patch('/admin/site-settings', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.siteSettings });
    },
  });
}

export function useUploadSiteLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      const { data } = await api.post('/admin/site-settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.siteSettings });
    },
  });
}

export function useUploadSiteFavicon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('favicon', file);
      const { data } = await api.post('/admin/site-settings/favicon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.siteSettings });
    },
  });
}

export function useUploadSiteOgImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('ogImage', file);
      const { data } = await api.post('/admin/site-settings/og-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.siteSettings });
    },
  });
}

// ===== Plans =====
export function useAdminPlans() {
  return useQuery({
    queryKey: adminKeys.plans,
    queryFn: async () => {
      const { data } = await api.get('/admin/plans');
      return data.data;
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ plan, ...body }: { plan: string; [key: string]: unknown }) => {
      const { data } = await api.patch(`/admin/plans/${plan}`, body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.plans });
    },
  });
}

// ===== Enhanced User Actions =====
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
    mutationFn: async ({ userId, ...updates }: { userId: string; firstName?: string; lastName?: string; email?: string }) => {
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

// ===== Config =====
export function useAdminConfigs() {
  return useQuery({
    queryKey: adminKeys.config,
    queryFn: async () => {
      const { data } = await api.get('/admin/config');
      return data.data;
    },
  });
}

export function useAdminConfigCategory(category: string) {
  return useQuery({
    queryKey: adminKeys.configCategory(category),
    queryFn: async () => {
      const { data } = await api.get(`/admin/config/${category}`);
      return data.data;
    },
    enabled: !!category,
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { data } = await api.patch(`/admin/config/${key}`, { value });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
  });
}

export function useTestConfig() {
  return useMutation({
    mutationFn: async (category: string) => {
      const { data } = await api.post(`/admin/config/test/${category}`);
      return data.data;
    },
  });
}

// Audit Log
export function useAdminAuditLog(params: { page: number; limit: number; action?: string; targetType?: string; userId?: string; targetId?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: adminKeys.auditLog(params),
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
export function useAdminLoginActivity(params: { page: number; limit: number; email?: string; ip?: string; success?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: adminKeys.loginActivity(params),
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
    queryKey: adminKeys.loginActivityStats,
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
    queryKey: adminKeys.blockedIPs(params),
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
    queryKey: adminKeys.sessions(params),
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
    queryKey: adminKeys.sessionStats,
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

// ===== Feature Flags =====
export function useAdminFeatureFlags() {
  return useQuery({
    queryKey: adminKeys.featureFlags,
    queryFn: async () => {
      const { data } = await api.get('/admin/feature-flags');
      return data.data;
    },
  });
}

export function useCreateFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { key: string; description: string; enabled: boolean }) => {
      const { data } = await api.post('/admin/feature-flags', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feature-flags'] });
    },
  });
}

export function useUpdateFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, ...body }: { key: string; description?: string; enabled?: boolean }) => {
      const { data } = await api.patch(`/admin/feature-flags/${key}`, body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feature-flags'] });
    },
  });
}

export function useDeleteFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { data } = await api.delete(`/admin/feature-flags/${key}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feature-flags'] });
    },
  });
}

// ===== Error Logs =====
export function useAdminErrorLogs(params: { page: number; limit: number; level?: string; source?: string; startDate?: string; endDate?: string; search?: string }) {
  return useQuery({
    queryKey: adminKeys.errorLogs(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
      if (params.level) searchParams.set('level', params.level);
      if (params.source) searchParams.set('source', params.source);
      if (params.startDate) searchParams.set('startDate', params.startDate);
      if (params.endDate) searchParams.set('endDate', params.endDate);
      if (params.search) searchParams.set('search', params.search);
      const { data } = await api.get(`/admin/error-logs?${searchParams}`);
      return data.data;
    },
  });
}

export function useCleanupErrorLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (olderThanDays: number) => {
      const { data } = await api.delete('/admin/error-logs/cleanup', { data: { olderThanDays } });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'error-logs'] });
    },
  });
}

// ===== Webhook Logs =====
export function useAdminWebhookLogs(params: { page: number; limit: number; webhookId?: string; event?: string; success?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: adminKeys.webhookLogs(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
      if (params.webhookId) searchParams.set('webhookId', params.webhookId);
      if (params.event) searchParams.set('event', params.event);
      if (params.success) searchParams.set('success', params.success);
      if (params.startDate) searchParams.set('startDate', params.startDate);
      if (params.endDate) searchParams.set('endDate', params.endDate);
      const { data } = await api.get(`/admin/webhook-logs?${searchParams}`);
      return data.data;
    },
  });
}

export function useAdminWebhookLogStats() {
  return useQuery({
    queryKey: adminKeys.webhookLogStats,
    queryFn: async () => {
      const { data } = await api.get('/admin/webhook-logs/stats');
      return data.data;
    },
    refetchInterval: 30000,
  });
}

// ===== Email Templates =====
export function useAdminEmailTemplates() {
  return useQuery({
    queryKey: adminKeys.emailTemplates,
    queryFn: async () => {
      const { data } = await api.get('/admin/email-templates');
      return data.data;
    },
  });
}

export function useUpsertEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, ...body }: { key: string; subject: string; subjectAr?: string; bodyHtml: string; bodyHtmlAr?: string; bodyText?: string; variables?: string[] }) => {
      const { data } = await api.put(`/admin/email-templates/${key}`, body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] });
    },
  });
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { data } = await api.delete(`/admin/email-templates/${key}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] });
    },
  });
}

export function useSeedEmailTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/admin/email-templates/seed');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] });
    },
  });
}

// ===== File Manager =====
export function useAdminFiles(params: { page: number; limit: number; search?: string; type?: string }) {
  return useQuery({
    queryKey: adminKeys.fileManager(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
      if (params.search) searchParams.set('search', params.search);
      if (params.type) searchParams.set('type', params.type);
      const { data } = await api.get(`/admin/files?${searchParams}`);
      return data.data;
    },
  });
}

export function useAdminFileStats() {
  return useQuery({
    queryKey: adminKeys.fileStats,
    queryFn: async () => {
      const { data } = await api.get('/admin/files/stats');
      return data.data;
    },
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (relativePath: string) => {
      const encoded = btoa(relativePath);
      const { data } = await api.delete(`/admin/files/${encoded}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'files'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'file-stats'] });
    },
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/admin/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'files'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'file-stats'] });
    },
  });
}

// ===== Bulk Email =====
export function useAdminBulkEmails(params: { page: number; limit: number }) {
  return useQuery({
    queryKey: adminKeys.bulkEmail(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
      const { data } = await api.get(`/admin/bulk-email?${searchParams}`);
      return data.data;
    },
  });
}

export function useAdminBulkEmailDetail(id: string) {
  return useQuery({
    queryKey: adminKeys.bulkEmailDetail(id),
    queryFn: async () => {
      const { data } = await api.get(`/admin/bulk-email/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateBulkEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { subject: string; bodyHtml: string; targetFilter?: object }) => {
      const { data } = await api.post('/admin/bulk-email', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bulk-email'] });
    },
  });
}

export function useSendBulkEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/admin/bulk-email/${id}/send`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bulk-email'] });
    },
  });
}

export function useCancelBulkEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/admin/bulk-email/${id}/cancel`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bulk-email'] });
    },
  });
}

export function useRecipientCount(params: { plan?: string; status?: string; emailVerified?: boolean }) {
  return useQuery({
    queryKey: adminKeys.recipientCount(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.plan) searchParams.set('plan', params.plan);
      if (params.status) searchParams.set('status', params.status);
      if (params.emailVerified !== undefined) searchParams.set('emailVerified', String(params.emailVerified));
      const { data } = await api.get(`/admin/bulk-email/recipient-count?${searchParams}`);
      return data.data;
    },
    enabled: false, // Only fetch on demand
  });
}

// ===== Admin Notifications =====
export function useAdminNotifications(params: { page: number; limit: number; unreadOnly?: boolean }) {
  return useQuery({
    queryKey: adminKeys.notifications(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
      if (params.unreadOnly) searchParams.set('unreadOnly', 'true');
      const { data } = await api.get(`/admin/notifications?${searchParams}`);
      return data.data;
    },
  });
}

export function useAdminUnreadCount() {
  return useQuery({
    queryKey: adminKeys.unreadCount,
    queryFn: async () => {
      const { data } = await api.get('/admin/notifications/unread-count');
      return data.data;
    },
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/admin/notifications/${id}/read`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'unread-count'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/admin/notifications/mark-all-read');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'unread-count'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/notifications/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'unread-count'] });
    },
  });
}

// ===== Security Settings =====
export function useAdminSecuritySettings() {
  return useQuery({
    queryKey: adminKeys.securitySettings,
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
      queryClient.invalidateQueries({ queryKey: adminKeys.securitySettings });
    },
  });
}

// ===== Notification Settings =====
export function useAdminNotificationSettings() {
  return useQuery({
    queryKey: adminKeys.notificationSettings,
    queryFn: async () => {
      const { data } = await api.get('/admin/notification-settings');
      return data.data;
    },
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      const { data } = await api.patch('/admin/notification-settings', { settings });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.notificationSettings });
    },
  });
}

export function useTestNotificationEmail() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/admin/notification-settings/test-email');
      return data.data;
    },
  });
}

// ===== Org Defaults =====
export function useAdminOrgDefaults() {
  return useQuery({
    queryKey: adminKeys.orgDefaults,
    queryFn: async () => {
      const { data } = await api.get('/admin/org-defaults');
      return data.data;
    },
  });
}

export function useUpdateOrgDefaults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      const { data } = await api.patch('/admin/org-defaults', { settings });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.orgDefaults });
    },
  });
}

// ===== Landing Page CMS =====
export function useAdminLandingPage() {
  return useQuery({
    queryKey: adminKeys.landingPage,
    queryFn: async () => {
      const { data } = await api.get('/admin/landing-page');
      return data.data;
    },
  });
}

export function useUpdateLandingPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.patch('/admin/landing-page', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.landingPage });
    },
  });
}

// ===== Dead Letter Queue =====
export function useAdminDLQ(params: { page: number; limit: number }) {
  return useQuery({
    queryKey: adminKeys.dlq(params),
    queryFn: async () => {
      const { data } = await api.get('/admin/dlq', { params });
      return data;
    },
  });
}

export function useRetryDLQJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/admin/dlq/${id}/retry`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dlq'] });
    },
  });
}

export function useDiscardDLQJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/dlq/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dlq'] });
    },
  });
}
