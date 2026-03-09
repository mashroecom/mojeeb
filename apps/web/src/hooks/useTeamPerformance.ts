'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const teamPerformanceKeys = {
  realTime: (orgId?: string) => ['team-performance', 'real-time', orgId] as const,
  historical: (params?: object) => ['team-performance', 'historical', params] as const,
  agentComparison: (agentIds?: string[], dateRange?: object) =>
    ['team-performance', 'agent-comparison', agentIds, dateRange] as const,
  aiVsHuman: (dateRange?: object) => ['team-performance', 'ai-vs-human', dateRange] as const,
};

// Real-time metrics (auto-refresh every 5 seconds)
export function useTeamPerformanceRealTime(orgId?: string) {
  return useQuery({
    queryKey: teamPerformanceKeys.realTime(orgId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (orgId) searchParams.set('orgId', orgId);
      const query = searchParams.toString();
      const { data } = await api.get(`/admin/team-performance/real-time${query ? `?${query}` : ''}`);
      return data.data;
    },
    refetchInterval: 5000,
    enabled: !!orgId,
  });
}

// Historical metrics with date range filtering
export function useTeamPerformanceHistorical(params?: {
  orgId?: string;
  startDate?: string;
  endDate?: string;
  agentIds?: string[];
  channel?: string;
  conversationType?: 'AI' | 'HUMAN' | 'HYBRID';
}) {
  return useQuery({
    queryKey: teamPerformanceKeys.historical(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.orgId) searchParams.set('orgId', params.orgId);
      if (params?.startDate) searchParams.set('startDate', params.startDate);
      if (params?.endDate) searchParams.set('endDate', params.endDate);
      if (params?.agentIds && params.agentIds.length > 0) {
        searchParams.set('agentIds', params.agentIds.join(','));
      }
      if (params?.channel) searchParams.set('channel', params.channel);
      if (params?.conversationType) searchParams.set('conversationType', params.conversationType);
      const query = searchParams.toString();
      const { data } = await api.get(`/admin/team-performance/historical${query ? `?${query}` : ''}`);
      return data.data;
    },
    enabled: !!params?.orgId,
  });
}

// Agent comparison for side-by-side performance analysis
export function useAgentComparison(
  agentIds?: string[],
  dateRange?: { startDate?: string; endDate?: string; orgId?: string }
) {
  return useQuery({
    queryKey: teamPerformanceKeys.agentComparison(agentIds, dateRange),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (dateRange?.orgId) searchParams.set('orgId', dateRange.orgId);
      if (dateRange?.startDate) searchParams.set('startDate', dateRange.startDate);
      if (dateRange?.endDate) searchParams.set('endDate', dateRange.endDate);
      if (agentIds && agentIds.length > 0) {
        searchParams.set('agentIds', agentIds.join(','));
      }
      const query = searchParams.toString();
      const { data } = await api.get(`/admin/team-performance/agents/compare${query ? `?${query}` : ''}`);
      return data.data;
    },
    enabled: !!dateRange?.orgId && !!agentIds && agentIds.length > 0,
  });
}

// AI vs Human performance comparison
export function useAiVsHuman(dateRange?: {
  startDate?: string;
  endDate?: string;
  orgId?: string;
  channel?: string;
}) {
  return useQuery({
    queryKey: teamPerformanceKeys.aiVsHuman(dateRange),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (dateRange?.orgId) searchParams.set('orgId', dateRange.orgId);
      if (dateRange?.startDate) searchParams.set('startDate', dateRange.startDate);
      if (dateRange?.endDate) searchParams.set('endDate', dateRange.endDate);
      if (dateRange?.channel) searchParams.set('channel', dateRange.channel);
      const query = searchParams.toString();
      const { data } = await api.get(`/admin/team-performance/ai-vs-human${query ? `?${query}` : ''}`);
      return data.data;
    },
    enabled: !!dateRange?.orgId,
  });
}
