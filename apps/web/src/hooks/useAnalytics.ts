'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export interface OverviewData {
  totalConversations: number;
  totalMessages: number;
  totalLeads: number;
  activeConversations: number;
  resolvedConversations: number;
  averageResponseTimeMs: number;
  handoffRate: number;
}

export interface ConversationMetricsData {
  metrics: Array<{
    date: string;
    conversations: number;
    messages: number;
  }>;
}

export interface AgentPerformanceData {
  agents: Array<{
    id: string;
    name: string;
    conversations: number;
    messages: number;
    resolved: number;
    averageResponseTimeMs: number;
  }>;
}

export interface ChannelBreakdownData {
  channels: Array<{
    channel: string;
    conversations: number;
    messages: number;
  }>;
}

export interface LeadFunnelData {
  funnel: Array<{
    stage: string;
    count: number;
    percentage: number;
  }>;
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface CsatTrendsData {
  trends: Array<{
    date: string;
    avgRating: number;
    count: number;
  }>;
}

export interface ResponseTimeTrendsData {
  trends: Array<{
    date: string;
    avgResponseTimeMs: number;
    count: number;
  }>;
}

export const analyticsKeys = {
  overview: (orgId: string) => ['organizations', orgId, 'analytics', 'overview'] as const,
  conversationMetrics: (orgId: string, params?: { startDate?: string; endDate?: string; groupBy?: string }) =>
    ['organizations', orgId, 'analytics', 'conversations-metrics', params] as const,
  agentPerformance: (orgId: string) => ['organizations', orgId, 'analytics', 'agent-performance'] as const,
  channelBreakdown: (orgId: string) => ['organizations', orgId, 'analytics', 'channel-breakdown'] as const,
  leadFunnel: (orgId: string) => ['organizations', orgId, 'analytics', 'lead-funnel'] as const,
  csatTrends: (orgId: string, params?: { startDate?: string; endDate?: string; groupBy?: string }) =>
    ['organizations', orgId, 'analytics', 'csat-trends', params] as const,
  responseTimeTrends: (orgId: string, params?: { startDate?: string; endDate?: string; groupBy?: string }) =>
    ['organizations', orgId, 'analytics', 'response-time-trends', params] as const,
};

export function useAnalyticsOverview() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: analyticsKeys.overview(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<OverviewData>>(
        `/organizations/${orgId}/analytics/overview`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useConversationMetrics(params?: {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}) {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: analyticsKeys.conversationMetrics(orgId!, params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.startDate) searchParams.set('startDate', params.startDate);
      if (params?.endDate) searchParams.set('endDate', params.endDate);
      if (params?.groupBy) searchParams.set('groupBy', params.groupBy);
      const query = searchParams.toString();
      const { data } = await api.get<ApiResponse<ConversationMetricsData>>(
        `/organizations/${orgId}/analytics/conversations-metrics${query ? `?${query}` : ''}`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useAgentPerformance() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: analyticsKeys.agentPerformance(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AgentPerformanceData>>(
        `/organizations/${orgId}/analytics/agent-performance`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useChannelBreakdown() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: analyticsKeys.channelBreakdown(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ChannelBreakdownData>>(
        `/organizations/${orgId}/analytics/channel-breakdown`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useLeadFunnel() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: analyticsKeys.leadFunnel(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<LeadFunnelData>>(
        `/organizations/${orgId}/analytics/lead-funnel`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useCsatTrends(params?: {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}) {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: analyticsKeys.csatTrends(orgId!, params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.startDate) searchParams.set('startDate', params.startDate);
      if (params?.endDate) searchParams.set('endDate', params.endDate);
      if (params?.groupBy) searchParams.set('groupBy', params.groupBy);
      const query = searchParams.toString();
      const { data } = await api.get<ApiResponse<CsatTrendsData>>(
        `/organizations/${orgId}/analytics/csat-trends${query ? `?${query}` : ''}`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useResponseTimeTrends(params?: {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}) {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: analyticsKeys.responseTimeTrends(orgId!, params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.startDate) searchParams.set('startDate', params.startDate);
      if (params?.endDate) searchParams.set('endDate', params.endDate);
      if (params?.groupBy) searchParams.set('groupBy', params.groupBy);
      const query = searchParams.toString();
      const { data } = await api.get<ApiResponse<ResponseTimeTrendsData>>(
        `/organizations/${orgId}/analytics/response-time-trends${query ? `?${query}` : ''}`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}
