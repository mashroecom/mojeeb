'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AdminOverviewData {
  totalUsers: number;
  totalOrganizations: number;
  totalSubscriptions: number;
  totalRevenue: number;
  activeUsers: number;
  activeOrganizations: number;
  newUsersToday: number;
  newOrganizationsToday: number;
}

export interface AdminGrowthData {
  metrics: Array<{
    date: string;
    users: number;
    organizations: number;
    subscriptions: number;
  }>;
}

export interface AdminRevenueData {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  averageRevenuePerUser: number;
  revenueByPlan: Array<{
    plan: string;
    revenue: number;
    count: number;
  }>;
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

export const adminAnalyticsKeys = {
  overview: ['admin', 'overview'] as const,
  growth: (params?: { startDate?: string; endDate?: string; groupBy?: string }) =>
    ['admin', 'growth', params] as const,
  revenue: ['admin', 'revenue'] as const,
  dailyRevenue: ['admin', 'daily-revenue'] as const,
  topOrgs: ['admin', 'top-organizations'] as const,
  recentActivity: ['admin', 'recent-activity'] as const,
};

// Platform Overview (auto-refresh every 30 seconds)
export function useAdminOverview() {
  return useQuery({
    queryKey: adminAnalyticsKeys.overview,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AdminOverviewData>>('/admin/analytics/overview');
      return data.data;
    },
    refetchInterval: 30000,
  });
}

// Platform Growth
export function useAdminGrowth(params?: {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}) {
  return useQuery({
    queryKey: adminAnalyticsKeys.growth(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.startDate) searchParams.set('startDate', params.startDate);
      if (params?.endDate) searchParams.set('endDate', params.endDate);
      if (params?.groupBy) searchParams.set('groupBy', params.groupBy);
      const query = searchParams.toString();
      const { data } = await api.get<ApiResponse<AdminGrowthData>>(
        `/admin/analytics/growth${query ? `?${query}` : ''}`,
      );
      return data.data;
    },
  });
}

// Revenue
export function useAdminRevenue() {
  return useQuery({
    queryKey: adminAnalyticsKeys.revenue,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AdminRevenueData>>('/admin/analytics/revenue');
      return data.data;
    },
  });
}

// Daily Revenue
export function useAdminDailyRevenue() {
  return useQuery({
    queryKey: adminAnalyticsKeys.dailyRevenue,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Array<{ date: string; revenue: number }>>>(
        '/admin/analytics/daily-revenue',
      );
      return data.data;
    },
  });
}

// Top Organizations by Revenue
export function useAdminTopOrganizations() {
  return useQuery({
    queryKey: adminAnalyticsKeys.topOrgs,
    queryFn: async () => {
      const { data } = await api.get<
        ApiResponse<
          Array<{
            id: string;
            name: string;
            revenue: number;
            userCount: number;
          }>
        >
      >('/admin/analytics/top-organizations');
      return data.data;
    },
  });
}

// Recent Activity
export function useAdminRecentActivity() {
  return useQuery({
    queryKey: adminAnalyticsKeys.recentActivity,
    queryFn: async () => {
      const { data } = await api.get<
        ApiResponse<
          Array<{
            id: string;
            type: string;
            description: string;
            timestamp: string;
            userId?: string;
            organizationId?: string;
          }>
        >
      >('/admin/analytics/recent-activity');
      return data.data;
    },
  });
}
