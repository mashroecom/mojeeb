'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useAgent, useConnectChannelForAgent, agentKeys } from '@/hooks/useAgents';
import { useAuthStore } from '@/stores/authStore';
import {
  useDisconnectChannel,
  useToggleChannel,
  useUpdateChannelSettings,
  type ChannelType,
} from '@/hooks/useChannels';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  CHANNEL_CONFIG,
  CHANNEL_KEYS,
  ConnectModal,
  DisconnectModal,
  WebChatSettingsPanel,
  EmbedCodeBlock,
  getChannelKey,
} from '@/components/channels/ChannelForms';
import {
  Globe,
  Plus,
  Loader2,
  Power,
  PowerOff,
  Trash2,
  Settings,
} from 'lucide-react';

export function ChannelsSection({ agentId }: { agentId: string }) {
  const t = useTranslations('dashboard.agents');
  const tc = useTranslations('dashboard.channels');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);
  const { data: agent } = useAgent(agentId);

  const connectChannel = useConnectChannelForAgent();
  const disconnectChannel = useDisconnectChannel();
  const toggleChannel = useToggleChannel();
  const updateChannelSettings = useUpdateChannelSettings();

  const [connectModalKey, setConnectModalKey] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<{ channelId: string } | null>(null);
  const [settingsChannelId, setSettingsChannelId] = useState<string | null>(null);

  const handleConnect = (
    type: ChannelType,
    credentials: Record<string, string>,
    name: string,
  ) => {
    connectChannel.mutate(
      { agentId, type, name, credentials },
      {
        onSuccess: () => {
          toast.success(tCommon('toast.channelConnected'));
          setConnectModalKey(null);
          setShowTypeSelector(false);
        },
        onError: () => {
          toast.error(tCommon('toast.channelConnectFailed'));
        },
      },
    );
  };

  const handleDisconnect = () => {
    if (!disconnectTarget) return;
    disconnectChannel.mutate(disconnectTarget.channelId, {
      onSuccess: () => {
        toast.success(tCommon('toast.channelDisconnected'));
        setDisconnectTarget(null);
      },
      onError: () => {
        toast.error(tCommon('toast.channelDisconnectFailed'));
      },
    });
  };

  const handleToggle = (channelId: string) => {
    toggleChannel.mutate(channelId, {
      onSuccess: (updatedChannel) => {
        toast.success(tCommon('toast.channelToggled'));
        // Directly update the agent detail cache so the icon flips immediately
        if (orgId) {
          queryClient.setQueryData(
            agentKeys.detail(orgId, agentId),
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                channels: old.channels.map((ac: any) =>
                  ac.channelId === channelId
                    ? { ...ac, channel: { ...ac.channel, isActive: updatedChannel.isActive } }
                    : ac,
                ),
              };
            },
          );
        }
      },
      onError: () => toast.error(tCommon('toast.channelToggleFailed')),
    });
  };

  const handleSaveSettings = (
    channelId: string,
    settings: { primaryColor?: string; greeting?: string; position?: string },
  ) => {
    updateChannelSettings.mutate({ channelId, settings }, {
      onSuccess: () => toast.success(tCommon('toast.settingsUpdated')),
      onError: () => toast.error(tCommon('toast.settingsUpdateFailed')),
    });
  };

  // Build a set of channel types already connected to this agent
  const connectedTypes = new Set(
    agent?.channels?.map((ac) => ac.channel.type?.toLowerCase()) ?? [],
  );
  // Check if all channel types are already connected
  const allTypesConnected = CHANNEL_KEYS.every((key) => connectedTypes.has(key));

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Globe className="h-5 w-5" />
              {t('channels')}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t('channelsHint')}
            </p>
          </div>
          {!allTypesConnected && (
            <button
              type="button"
              onClick={() => setShowTypeSelector(!showTypeSelector)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-3 w-3" />
              {t('connectChannel')}
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Channel type selector */}
        {showTypeSelector && (
          <div className="mb-4 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {t('selectChannelType')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CHANNEL_KEYS.map((key) => {
                const config = CHANNEL_CONFIG[key];
                const Icon = config.icon;
                const alreadyConnected = connectedTypes.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={alreadyConnected}
                    onClick={() => {
                      setConnectModalKey(key);
                      setShowTypeSelector(false);
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border bg-background px-3 py-2.5 text-sm font-medium transition-colors',
                      alreadyConnected
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:bg-muted',
                    )}
                    title={alreadyConnected ? tc('channelAlreadyConnected') : undefined}
                  >
                    <div
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-lg shrink-0',
                        config.color,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="flex-1 text-start">{tc(`${key}.name`)}</span>
                    {alreadyConnected && (
                      <span className="text-[10px] text-muted-foreground">{tc('connected')}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Connected channels */}
        {agent?.channels && agent.channels.length > 0 ? (
          <div className="space-y-3">
            {agent.channels.map((ac) => {
              const channelKey = getChannelKey(ac.channel.type as ChannelType);
              const config = CHANNEL_CONFIG[channelKey];
              const Icon = config?.icon || Globe;
              const isWebchat = ac.channel.type === 'WEBCHAT';
              const showSettings = settingsChannelId === ac.channelId;

              return (
                <div
                  key={ac.channelId}
                  className="rounded-lg border px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                          config?.color || 'bg-muted-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <span className="text-sm font-medium">
                          {ac.channel.name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {tc(`${channelKey}.name`)}
                          </span>
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                              ac.channel.isActive
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {ac.channel.isActive ? tc('channelActive') : tc('channelInactive')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Toggle active */}
                      <button
                        type="button"
                        onClick={() => handleToggle(ac.channelId)}
                        disabled={toggleChannel.isPending}
                        className={cn(
                          'inline-flex items-center justify-center rounded-lg border p-1.5 text-xs transition-colors hover:bg-muted',
                          toggleChannel.isPending && 'cursor-not-allowed opacity-50',
                        )}
                        title={ac.channel.isActive ? tc('channelInactive') : tc('channelActive')}
                      >
                        {toggleChannel.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : ac.channel.isActive ? (
                          <Power className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>

                      {/* Settings (webchat only) */}
                      {isWebchat && (
                        <button
                          type="button"
                          onClick={() =>
                            setSettingsChannelId(showSettings ? null : ac.channelId)
                          }
                          className="inline-flex items-center justify-center rounded-lg border p-1.5 text-xs transition-colors hover:bg-muted"
                          title={tc('webchatSettings')}
                        >
                          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      )}

                      {/* Disconnect */}
                      <button
                        type="button"
                        onClick={() => setDisconnectTarget({ channelId: ac.channelId })}
                        className="inline-flex items-center justify-center rounded-lg border border-red-200 p-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                        title={tc('disconnect')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* WebChat settings panel */}
                  {isWebchat && showSettings && (
                    <WebChatSettingsPanel
                      channel={{
                        id: ac.channelId,
                        type: ac.channel.type as ChannelType,
                        name: ac.channel.name,
                        isActive: ac.channel.isActive,
                        credentials: ac.channel.credentials,
                        webhookSecret: ac.channel.webhookSecret,
                        externalId: ac.channel.externalId,
                        agents: [],
                        createdAt: ac.channel.createdAt,
                        updatedAt: ac.channel.updatedAt,
                      }}
                      onSave={handleSaveSettings}
                      isPending={updateChannelSettings.isPending}
                    />
                  )}

                  {/* WebChat embed code */}
                  {isWebchat && (
                    <EmbedCodeBlock
                      channel={{
                        id: ac.channelId,
                        type: ac.channel.type as ChannelType,
                        name: ac.channel.name,
                        isActive: ac.channel.isActive,
                        credentials: ac.channel.credentials,
                        webhookSecret: ac.channel.webhookSecret,
                        externalId: ac.channel.externalId,
                        agents: [],
                        createdAt: ac.channel.createdAt,
                        updatedAt: ac.channel.updatedAt,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('noChannels')}
          </p>
        )}
      </div>

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
