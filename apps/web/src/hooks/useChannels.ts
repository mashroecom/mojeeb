'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { agentKeys } from './useAgents';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChannelType = 'WHATSAPP' | 'MESSENGER' | 'INSTAGRAM' | 'WEBCHAT';

export interface ChannelAgent {
  channelId: string;
  agentId: string;
  isPrimary: boolean;
  agent: {
    id: string;
    name: string;
    isActive: boolean;
  };
}

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  isActive: boolean;
  credentials: Record<string, string>;
  webhookSecret: string | null;
  externalId: string | null;
  agents: ChannelAgent[];
  _count?: { conversations: number };
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const channelKeys = {
  all: (orgId: string) => ['organizations', orgId, 'channels'] as const,
  detail: (orgId: string, channelId: string) =>
    ['organizations', orgId, 'channels', channelId] as const,
};

// ---------------------------------------------------------------------------
// useChannels - list all channels
// ---------------------------------------------------------------------------

export function useChannels() {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: channelKeys.all(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Channel[]>>(
        `/organizations/${orgId}/channels`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}

// ---------------------------------------------------------------------------
// useDisconnectChannel - mutation to disconnect/delete a channel
// ---------------------------------------------------------------------------

export function useDisconnectChannel() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      await api.delete(`/organizations/${orgId}/channels/${channelId}`);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: channelKeys.all(orgId) });
        queryClient.invalidateQueries({ queryKey: agentKeys.all(orgId) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useToggleChannel - mutation to toggle active/inactive
// ---------------------------------------------------------------------------

export function useToggleChannel() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data } = await api.patch<ApiResponse<Channel>>(
        `/organizations/${orgId}/channels/${channelId}/toggle`,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: channelKeys.all(orgId) });
        queryClient.invalidateQueries({ queryKey: agentKeys.all(orgId) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateChannelSettings - mutation to update webchat channel settings
// ---------------------------------------------------------------------------

export function useUpdateChannelSettings() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      settings,
    }: {
      channelId: string;
      settings: { primaryColor?: string; greeting?: string; position?: string };
    }) => {
      const { data } = await api.patch<ApiResponse<Channel>>(
        `/organizations/${orgId}/channels/${channelId}/settings`,
        settings,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: channelKeys.all(orgId) });
        queryClient.invalidateQueries({ queryKey: agentKeys.all(orgId) });
      }
    },
  });
}

