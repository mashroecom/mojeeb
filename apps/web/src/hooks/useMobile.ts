'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Hooks for the mobile app (/mobile). They talk to the member-scoped /mobile API,
 * which returns data for the organizations the signed-in user belongs to — unlike
 * the /admin API, which is platform-wide and super-admin only.
 */

export interface MobileConversation {
  id: string;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  lastEmotion: string | null;
  lastMessageAt: string | null;
  org?: { id: string; name: string; logoUrl: string | null };
  channel?: { id: string; name: string; type: string };
  agent?: { id: string; name: string } | null;
  _count?: { messages: number };
}

export interface MobileInboxResponse {
  conversations: MobileConversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MobileMetric {
  label: string;
  value: number;
  previousValue: number;
  changePercent: number;
}

export interface MobileStats {
  total: number;
  byStatus: Array<{ status: string; _count: number }>;
  activeOrgs: number;
}

export const mobileKeys = {
  inbox: (params: Record<string, unknown>) => ['mobile', 'inbox', params] as const,
  analytics: ['mobile', 'analytics'] as const,
  stats: ['mobile', 'stats'] as const,
};

/** Conversations across the user's organizations, newest activity first. */
export function useMobileInbox(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: mobileKeys.inbox(params),
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
      if (params.search) sp.set('search', params.search);
      if (params.status) sp.set('status', params.status);
      const { data } = await api.get(`/mobile/inbox?${sp}`);
      return data.data as MobileInboxResponse;
    },
  });
}

/** Key metrics for the last 30 days, each with its change versus the 30 days before. */
export function useMobileAnalytics() {
  return useQuery({
    queryKey: mobileKeys.analytics,
    queryFn: async () => {
      const { data } = await api.get('/mobile/analytics/dashboard');
      return data.data as MobileMetric[];
    },
  });
}

/** Conversation totals and their breakdown by status. */
export function useMobileStats() {
  return useQuery({
    queryKey: mobileKeys.stats,
    queryFn: async () => {
      const { data } = await api.get('/mobile/stats');
      return data.data as MobileStats;
    },
  });
}
