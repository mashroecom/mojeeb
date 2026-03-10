'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentKnowledgeBaseLink {
  agentId: string;
  knowledgeBaseId: string;
  knowledgeBase: { id: string; name: string };
}

export interface AgentChannelLink {
  channelId: string;
  agentId: string;
  isPrimary: boolean;
  channel: {
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    credentials: Record<string, string>;
    webhookSecret: string | null;
    externalId: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export interface DataCollectionConfig {
  requiredFields: string[];
  collectionStrategy: 'natural' | 'upfront' | 'end';
  customFields: { name: string; type: string; label: string; labelAr: string }[];
  confirmationEnabled: boolean;
}

export interface QuickRepliesConfig {
  enabled: boolean;
  maxButtons: number;
  aiSuggestions: boolean;
  predefinedSets: {
    trigger: string;
    buttons: { text: string; textAr: string }[];
  }[];
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  aiProvider: 'OPENAI' | 'ANTHROPIC';
  aiModel: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  language: string;
  isActive: boolean;
  templateType: string | null;
  enableEmotionDetection: boolean;
  enableLeadExtraction: boolean;
  enableHumanHandoff: boolean;
  tone: string;
  responseLength: string;
  dataCollectionConfig: DataCollectionConfig | null;
  escalationKeywords: string[];
  sentimentEscalation: boolean;
  escalationMessageCount: number;
  quickRepliesConfig: QuickRepliesConfig | null;
  knowledgeBases?: AgentKnowledgeBaseLink[];
  channels?: AgentChannelLink[];
  _count?: { conversations: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  description?: string | null;
  systemPrompt: string;
  templateType?: string;
  aiProvider?: 'OPENAI' | 'ANTHROPIC';
  aiModel?: string;
  language?: string;
  temperature?: number;
  maxTokens?: number;
  isActive?: boolean;
  enableEmotionDetection?: boolean;
  enableLeadExtraction?: boolean;
  enableHumanHandoff?: boolean;
  handoffThreshold?: number;
  tone?: string;
  responseLength?: string;
  dataCollectionConfig?: DataCollectionConfig;
  escalationKeywords?: string[];
  sentimentEscalation?: boolean;
  escalationMessageCount?: number;
  quickRepliesConfig?: QuickRepliesConfig;
}

export type UpdateAgentInput = Partial<CreateAgentInput> & { id: string };

export interface TestAgentInput {
  agentId: string;
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

export interface TestAgentResponse {
  reply: string;
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const agentKeys = {
  all: (orgId: string) => ['organizations', orgId, 'agents'] as const,
  detail: (orgId: string, agentId: string) => ['organizations', orgId, 'agents', agentId] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * List all agents for the current organization.
 */
export function useAgents() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: agentKeys.all(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Agent[]>>(`/organizations/${orgId}/agents`);
      return data.data;
    },
    enabled: !!orgId,
  });
}

/**
 * Get a single agent by ID.
 */
export function useAgent(agentId: string | undefined) {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useQuery({
    queryKey: agentKeys.detail(orgId!, agentId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Agent>>(
        `/organizations/${orgId}/agents/${agentId}`,
      );
      return data.data;
    },
    enabled: !!orgId && !!agentId,
  });
}

/**
 * Create a new agent.
 * Invalidates the agents list on success.
 */
export function useCreateAgent() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAgentInput) => {
      if (!orgId) throw new Error('No organization selected');
      const { data } = await api.post<ApiResponse<Agent>>(`/organizations/${orgId}/agents`, input);
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: agentKeys.all(orgId) });
      }
    },
  });
}

/**
 * Update an existing agent.
 * Invalidates both the agents list and the individual agent cache on success.
 */
export function useUpdateAgent() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateAgentInput) => {
      if (!orgId) throw new Error('No organization selected');
      const { data } = await api.patch<ApiResponse<Agent>>(
        `/organizations/${orgId}/agents/${id}`,
        input,
      );
      return data.data;
    },
    onSuccess: (updatedAgent) => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: agentKeys.all(orgId) });
        queryClient.invalidateQueries({
          queryKey: agentKeys.detail(orgId, updatedAgent.id),
        });
      }
    },
  });
}

/**
 * Delete an agent.
 * Invalidates the agents list on success.
 */
export function useDeleteAgent() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (agentId: string) => {
      if (!orgId) throw new Error('No organization selected');
      await api.delete(`/organizations/${orgId}/agents/${agentId}`);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: agentKeys.all(orgId) });
      }
    },
  });
}

/**
 * Test an agent by sending it a message and receiving a reply.
 */
export function useTestAgent() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;

  return useMutation({
    mutationFn: async ({ agentId, message, history }: TestAgentInput) => {
      if (!orgId) throw new Error('No organization selected');
      const { data } = await api.post<ApiResponse<TestAgentResponse>>(
        `/organizations/${orgId}/agents/${agentId}/test`,
        { message, history },
      );
      return data.data;
    },
  });
}

/**
 * Link a knowledge base to an agent.
 */
export function useLinkKnowledgeBase() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agentId,
      knowledgeBaseId,
    }: {
      agentId: string;
      knowledgeBaseId: string;
    }) => {
      if (!orgId) throw new Error('No organization selected');
      const { data } = await api.post<ApiResponse<AgentKnowledgeBaseLink>>(
        `/organizations/${orgId}/agents/${agentId}/knowledge-bases`,
        { knowledgeBaseId },
      );
      return data.data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: agentKeys.all(orgId) });
        queryClient.invalidateQueries({ queryKey: agentKeys.detail(orgId, variables.agentId) });
      }
    },
  });
}

/**
 * Unlink a knowledge base from an agent.
 */
export function useUnlinkKnowledgeBase() {
  const { organization } = useAuthStore();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agentId,
      knowledgeBaseId,
    }: {
      agentId: string;
      knowledgeBaseId: string;
    }) => {
      if (!orgId) throw new Error('No organization selected');
      await api.delete(
        `/organizations/${orgId}/agents/${agentId}/knowledge-bases/${knowledgeBaseId}`,
      );
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: agentKeys.all(orgId) });
        queryClient.invalidateQueries({ queryKey: agentKeys.detail(orgId, variables.agentId) });
      }
    },
  });
}

/**
 * Connect a new channel and assign the agent as primary in one call.
 */
export function useConnectChannelForAgent() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async ({
      agentId,
      type,
      name,
      credentials,
    }: {
      agentId: string;
      type: string;
      name: string;
      credentials: Record<string, string>;
    }) => {
      const { data } = await api.post(`/organizations/${orgId}/agents/${agentId}/channels`, {
        type,
        name,
        credentials,
      });
      return data.data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: agentKeys.all(orgId) });
        queryClient.invalidateQueries({ queryKey: agentKeys.detail(orgId, variables.agentId) });
        queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'channels'] });
      }
    },
  });
}
