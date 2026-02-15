'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/hooks/useToast';

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

export interface ConnectChannelInput {
  type: ChannelType;
  name: string;
  credentials: Record<string, string>;
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
// useChannel - get single channel
// ---------------------------------------------------------------------------

export function useChannel(channelId: string | undefined) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: channelKeys.detail(orgId!, channelId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Channel>>(
        `/organizations/${orgId}/channels/${channelId}`,
      );
      return data.data;
    },
    enabled: !!orgId && !!channelId,
  });
}

// ---------------------------------------------------------------------------
// useConnectChannel - mutation to connect a new channel
// ---------------------------------------------------------------------------

export function useConnectChannel() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ConnectChannelInput) => {
      const { data } = await api.post<ApiResponse<Channel>>(
        `/organizations/${orgId}/channels`,
        input,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: channelKeys.all(orgId) });
      }
      toast.success('Channel connected');
    },
    onError: () => {
      toast.error('Failed to connect channel');
    },
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
      }
      toast.success('Channel disconnected');
    },
    onError: () => {
      toast.error('Failed to disconnect channel');
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
      }
    },
    onError: () => {
      toast.error('Failed to toggle channel');
    },
  });
}

// ---------------------------------------------------------------------------
// useAssignAgent - mutation to assign an agent to a channel
// ---------------------------------------------------------------------------

export function useAssignAgent() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      agentId,
      isPrimary = true,
    }: {
      channelId: string;
      agentId: string;
      isPrimary?: boolean;
    }) => {
      const { data } = await api.post<ApiResponse<ChannelAgent>>(
        `/organizations/${orgId}/channels/${channelId}/agents`,
        { agentId, isPrimary },
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: channelKeys.all(orgId) });
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
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useRemoveAgent - mutation to remove an agent from a channel
// ---------------------------------------------------------------------------

export function useRemoveAgent() {
  const orgId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      agentId,
    }: {
      channelId: string;
      agentId: string;
    }) => {
      await api.delete(
        `/organizations/${orgId}/channels/${channelId}/agents/${agentId}`,
      );
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: channelKeys.all(orgId) });
      }
    },
  });
}
