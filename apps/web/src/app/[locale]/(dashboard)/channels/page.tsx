'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  useChannels,
  useConnectChannel,
  useDisconnectChannel,
  useToggleChannel,
  useAssignAgent,
  useRemoveAgent,
  useUpdateChannelSettings,
  type Channel,
  type ChannelType,
} from '@/hooks/useChannels';
import { useAgents, type Agent } from '@/hooks/useAgents';
import {
  X,
  Check,
  Power,
  PowerOff,
  Trash2,
  Bot,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import {
  CHANNEL_CONFIG,
  CHANNEL_KEYS,
  getChannelKey,
  ConnectModal,
  DisconnectModal,
  WebChatSettingsPanel,
  EmbedCodeBlock,
} from '@/components/channels/ChannelForms';

// ---------------------------------------------------------------------------
// Agent selector dropdown
// ---------------------------------------------------------------------------

function AgentSelector({
  channel,
  agents,
  onAssign,
  onRemove,
  isPending,
}: {
  channel: Channel;
  agents: Agent[];
  onAssign: (channelId: string, agentId: string) => void;
  onRemove: (channelId: string, agentId: string) => void;
  isPending: boolean;
}) {
  const t = useTranslations('dashboard.channels');
  const [isOpen, setIsOpen] = useState(false);

  const primaryAgent = channel.agents?.find((ca) => ca.isPrimary);
  const selectedAgentName = primaryAgent?.agent?.name;

  const handleSelect = (agentId: string) => {
    onAssign(channel.id, agentId);
    setIsOpen(false);
  };

  const handleRemove = () => {
    if (primaryAgent) {
      onRemove(channel.id, primaryAgent.agentId);
    }
  };

  return (
    <div className="mt-3">
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {t('primaryAgent')}
      </label>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isPending}
          className={cn(
            'w-full flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted',
            isPending && 'cursor-not-allowed opacity-50',
          )}
        >
          <span className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : selectedAgentName ? (
              selectedAgentName
            ) : (
              <span className="text-muted-foreground">{t('selectAgent')}</span>
            )}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-180',
            )}
          />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute z-20 mt-1 w-full rounded-md border bg-card shadow-lg max-h-48 overflow-y-auto">
              {/* "No agent" option */}
              {primaryAgent && (
                <button
                  onClick={() => {
                    handleRemove();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-muted transition-colors dark:text-red-400"
                >
                  <X className="h-4 w-4" />
                  {t('noAgentAssigned')}
                </button>
              )}
              {agents
                .filter((a) => a.isActive)
                .map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleSelect(agent.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors',
                      primaryAgent?.agentId === agent.id &&
                        'bg-primary/5 font-medium',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      {agent.name}
                    </span>
                    {primaryAgent?.agentId === agent.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              {agents.filter((a) => a.isActive).length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {t('noAgentAssigned')}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ChannelCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-3 w-48 rounded bg-muted" />
          <div className="h-8 w-24 rounded bg-muted mt-3" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connected channel card
// ---------------------------------------------------------------------------

function ConnectedChannelCard({
  channelKey,
  channel,
  agents,
  onDisconnect,
  onToggle,
  onAssignAgent,
  onRemoveAgent,
  onSaveSettings,
  isToggling,
  isAssigning,
  isSavingSettings,
}: {
  channelKey: string;
  channel: Channel;
  agents: Agent[];
  onDisconnect: (channel: Channel) => void;
  onToggle: (channelId: string) => void;
  onAssignAgent: (channelId: string, agentId: string) => void;
  onRemoveAgent: (channelId: string, agentId: string) => void;
  onSaveSettings: (channelId: string, settings: { primaryColor?: string; greeting?: string; position?: string }) => void;
  isToggling: boolean;
  isAssigning: boolean;
  isSavingSettings: boolean;
}) {
  const t = useTranslations('dashboard.channels');
  const config = CHANNEL_CONFIG[channelKey];
  const Icon = config.icon;

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
            config.color,
          )}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{t(`${channelKey}.name`)}</h3>
            {config.popular && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {t('popular')}
              </span>
            )}
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {t('connected')}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {channel.name}
          </p>

          {/* Conversation count */}
          {channel._count && channel._count.conversations > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {channel._count.conversations} {t('conversations')}
            </p>
          )}

          {/* Active/Inactive toggle + Disconnect */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onToggle(channel.id)}
              disabled={isToggling}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                channel.isActive
                  ? 'border-green-200 text-green-700 hover:bg-green-50 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800',
                isToggling && 'cursor-not-allowed opacity-50',
              )}
            >
              {isToggling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : channel.isActive ? (
                <Power className="h-3 w-3" />
              ) : (
                <PowerOff className="h-3 w-3" />
              )}
              {channel.isActive ? t('channelActive') : t('channelInactive')}
            </button>

            <button
              onClick={() => onDisconnect(channel)}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              <Trash2 className="h-3 w-3" />
              {t('disconnect')}
            </button>
          </div>

          {/* Agent selector */}
          <AgentSelector
            channel={channel}
            agents={agents}
            onAssign={onAssignAgent}
            onRemove={onRemoveAgent}
            isPending={isAssigning}
          />

          {/* WebChat embed code */}
          {channel.type === 'WEBCHAT' && <EmbedCodeBlock channel={channel} />}

          {/* WebChat settings panel */}
          {channel.type === 'WEBCHAT' && (
            <WebChatSettingsPanel
              channel={channel}
              onSave={onSaveSettings}
              isPending={isSavingSettings}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Disconnected channel card
// ---------------------------------------------------------------------------

function DisconnectedChannelCard({
  channelKey,
  onConnect,
}: {
  channelKey: string;
  onConnect: (channelKey: string) => void;
}) {
  const t = useTranslations('dashboard.channels');
  const config = CHANNEL_CONFIG[channelKey];
  const Icon = config.icon;

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
            config.color,
          )}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{t(`${channelKey}.name`)}</h3>
            {config.popular && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {t('popular')}
              </span>
            )}
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {t('notConnected')}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(`${channelKey}.description`)}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground/70">
            {t(`${channelKey}.instructions`)}
          </p>
          <button
            onClick={() => onConnect(channelKey)}
            className="mt-3 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            {t('connect')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ChannelsPage() {
  const t = useTranslations('dashboard.channels');
  const tc = useTranslations('common');

  // Data
  const { data: channels, isLoading: channelsLoading, isError: channelsError, refetch } = useChannels();
  const { data: agents } = useAgents();

  // Mutations
  const connectChannel = useConnectChannel();
  const disconnectChannel = useDisconnectChannel();
  const toggleChannel = useToggleChannel();
  const assignAgent = useAssignAgent();
  const removeAgent = useRemoveAgent();
  const updateChannelSettings = useUpdateChannelSettings();

  // Modal state
  const [connectModalKey, setConnectModalKey] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<Channel | null>(
    null,
  );

  // Build a map of channel type -> connected channel
  const connectedMap = new Map<string, Channel>();
  if (channels) {
    for (const ch of channels) {
      const key = getChannelKey(ch.type);
      // If multiple of same type, keep first (most recent due to orderBy desc)
      if (!connectedMap.has(key)) {
        connectedMap.set(key, ch);
      }
    }
  }

  // Handlers
  const handleConnect = (
    type: ChannelType,
    credentials: Record<string, string>,
    name: string,
  ) => {
    connectChannel.mutate(
      { type, name, credentials },
      {
        onSuccess: () => {
          setConnectModalKey(null);
        },
      },
    );
  };

  const handleDisconnect = () => {
    if (!disconnectTarget) return;
    disconnectChannel.mutate(disconnectTarget.id, {
      onSuccess: () => {
        setDisconnectTarget(null);
      },
    });
  };

  const handleToggle = (channelId: string) => {
    toggleChannel.mutate(channelId);
  };

  const handleAssignAgent = (channelId: string, agentId: string) => {
    assignAgent.mutate({ channelId, agentId, isPrimary: true });
  };

  const handleRemoveAgent = (channelId: string, agentId: string) => {
    removeAgent.mutate({ channelId, agentId });
  };

  const handleSaveSettings = (
    channelId: string,
    settings: { primaryColor?: string; greeting?: string; position?: string },
  ) => {
    updateChannelSettings.mutate({ channelId, settings });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Loading state */}
      {channelsLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ChannelCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {!channelsLoading && channelsError && (
        <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <X className="h-6 w-6 text-destructive" />
          </div>
          <p className="font-medium">{tc('somethingWentWrong')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tc('errorDescription')}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {tc('tryAgain')}
          </button>
        </div>
      )}

      {/* Channel grid */}
      {!channelsLoading && !channelsError && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CHANNEL_KEYS.map((key) => {
            const connected = connectedMap.get(key);
            if (connected) {
              return (
                <ConnectedChannelCard
                  key={key}
                  channelKey={key}
                  channel={connected}
                  agents={agents || []}
                  onDisconnect={setDisconnectTarget}
                  onToggle={handleToggle}
                  onAssignAgent={handleAssignAgent}
                  onRemoveAgent={handleRemoveAgent}
                  onSaveSettings={handleSaveSettings}
                  isToggling={toggleChannel.isPending}
                  isAssigning={
                    assignAgent.isPending || removeAgent.isPending
                  }
                  isSavingSettings={updateChannelSettings.isPending}
                />
              );
            }
            return (
              <DisconnectedChannelCard
                key={key}
                channelKey={key}
                onConnect={setConnectModalKey}
              />
            );
          })}
        </div>
      )}

      {/* Connect modal */}
      {connectModalKey && (
        <ConnectModal
          open={!!connectModalKey}
          onClose={() => setConnectModalKey(null)}
          channelKey={connectModalKey}
          onConnect={handleConnect}
          isPending={connectChannel.isPending}
        />
      )}

      {/* Disconnect confirmation modal */}
      <DisconnectModal
        open={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={handleDisconnect}
        isPending={disconnectChannel.isPending}
      />
    </div>
  );
}
