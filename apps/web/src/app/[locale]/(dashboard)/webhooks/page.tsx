'use client';

import { useState, type ComponentType } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { fmtDate, fmtDateTime } from '@/lib/dateFormat';
import {
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useRegenerateWebhookSecret,
  useTestWebhook,
  useWebhookLogs,
} from '@/hooks/useWebhooks';
import type { WebhookWithSecret } from '@/hooks/useWebhooks';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  Webhook,
  Plus,
  Trash2,
  Copy,
  CheckCircle,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Power,
  Send,
  Pencil,
  ScrollText,
  Globe,
  X,
  ChevronDown,
  ChevronUp,
  Shield,
  Zap,
  ExternalLink,
} from 'lucide-react';

const inputClass =
  'w-full rounded-lg border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50';

const EVENTS = [
  'conversation.created',
  'conversation.closed',
  'message.received',
  'message.sent',
  'lead.created',
  'lead.updated',
] as const;

const EVENT_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'conversation.created': Zap,
  'conversation.closed': CheckCircle,
  'message.received': Globe,
  'message.sent': Send,
  'lead.created': Plus,
  'lead.updated': RefreshCw,
};

export default function WebhooksPage() {
  const t = useTranslations('dashboard.webhooks');
  const locale = useLocale();
  const ct = useTranslations('common');
  const ts = useTranslations('dashboard.sidebar');
  const tb = useTranslations('dashboard.breadcrumb');

  const { data: webhooks, isLoading, isError, refetch: refetchWebhooks } = useWebhooks();
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const regenerateSecret = useRegenerateWebhookSecret();
  const testWebhook = useTestWebhook();
  const { confirmProps, confirm } = useConfirmDialog();

  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [createdWebhook, setCreatedWebhook] = useState<WebhookWithSecret | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<{ id: string; type: 'success' | 'error' } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editEvents, setEditEvents] = useState<string[]>([]);
  const [logsId, setLogsId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: logs, isLoading: logsLoading } = useWebhookLogs(logsId);

  const startEditing = (webhook: { id: string; url: string; events: string[] }) => {
    setEditingId(webhook.id);
    setEditUrl(webhook.url);
    setEditEvents([...webhook.events]);
    setExpandedId(webhook.id);
  };

  const handleEditToggleEvent = (event: string) => {
    setEditEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const handleSaveEdit = () => {
    if (!editingId || !editUrl.trim() || editEvents.length === 0) return;
    updateWebhook.mutate(
      { webhookId: editingId, url: editUrl.trim(), events: editEvents },
      {
        onSuccess: () => {
          setEditingId(null);
          toast.success(ct('toast.webhookUpdated'));
        },
        onError: () => toast.error(ct('toast.webhookUpdateFailed')),
      },
    );
  };

  const toggleLogs = (webhookId: string) => {
    setLogsId((prev) => (prev === webhookId ? null : webhookId));
  };

  const handleTestWebhook = (webhookId: string) => {
    setTestStatus(null);
    testWebhook.mutate(webhookId, {
      onSuccess: () => {
        setTestStatus({ id: webhookId, type: 'success' });
        setTimeout(() => setTestStatus(null), 3000);
        toast.success(ct('toast.webhookTestSent'));
      },
      onError: () => {
        setTestStatus({ id: webhookId, type: 'error' });
        setTimeout(() => setTestStatus(null), 3000);
        toast.error(ct('toast.webhookTestFailed'));
      },
    });
  };

  const handleCreate = () => {
    if (!url.trim() || selectedEvents.length === 0) return;
    createWebhook.mutate(
      { url: url.trim(), events: selectedEvents },
      {
        onSuccess: (data) => {
          setCreatedWebhook(data);
          setUrl('');
          setSelectedEvents([]);
          setShowCreate(false);
          toast.success(ct('toast.webhookCreated'));
        },
        onError: () => toast.error(ct('toast.webhookCreateFailed')),
      },
    );
  };

  const handleToggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const handleToggleActive = (webhookId: string, isActive: boolean) => {
    updateWebhook.mutate(
      { webhookId, isActive: !isActive },
      {
        onSuccess: () => toast.success(ct('toast.webhookUpdated')),
        onError: () => toast.error(ct('toast.webhookUpdateFailed')),
      },
    );
  };

  const handleDelete = (webhookId: string) => {
    confirm({
      title: ct('delete'),
      message: t('deleteConfirm'),
      onConfirm: () =>
        deleteWebhook.mutate(webhookId, {
          onSuccess: () => toast.success(ct('toast.webhookDeleted')),
          onError: () => toast.error(ct('toast.webhookDeleteFailed')),
        }),
    });
  };

  const handleRegenerateSecret = (webhookId: string) => {
    confirm({
      title: t('regenerateSecret'),
      message: t('regenerateConfirm'),
      onConfirm: () =>
        regenerateSecret.mutate(webhookId, {
          onSuccess: (data) => {
            setNewSecret(data.secret);
            toast.success(ct('toast.secretRegenerated'));
          },
          onError: () => toast.error(ct('toast.secretRegenerateFailed')),
        }),
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Breadcrumb
        items={[
          { label: tb('dashboard'), href: '/dashboard' },
          { label: ts('webhooks') },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Webhook className="h-5 w-5 text-primary" />
            </div>
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {webhooks && webhooks.length > 0 && (
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('create')}
          </button>
        )}
      </div>

      {/* Created webhook secret banner */}
      {createdWebhook && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  {t('created')}
                </p>
                <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                  {t('secretWarning')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-amber-200 bg-white px-3.5 py-2 text-xs font-mono dark:border-amber-800 dark:bg-black/20">
                  {createdWebhook.secret}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdWebhook.secret)}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900 dark:text-amber-300 dark:hover:bg-amber-800 transition-colors"
                >
                  {copiedSecret ? (
                    <>
                      <CheckCircle className="h-3.5 w-3.5" />
                      {t('secretCopied')}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      {ct('copy')}
                    </>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setCreatedWebhook(null)}
                className="text-xs font-medium text-amber-700 underline hover:no-underline dark:text-amber-300"
              >
                {ct('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerated secret banner */}
      {newSecret && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                  {t('secret')}
                </p>
                <p className="mt-0.5 text-xs text-blue-600 dark:text-blue-400">
                  {t('secretWarning')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-blue-200 bg-white px-3.5 py-2 text-xs font-mono dark:border-blue-800 dark:bg-black/20">
                  {newSecret}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(newSecret)}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 transition-colors"
                >
                  {copiedSecret ? (
                    <>
                      <CheckCircle className="h-3.5 w-3.5" />
                      {t('secretCopied')}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      {ct('copy')}
                    </>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setNewSecret(null)}
                className="text-xs font-medium text-blue-700 underline hover:no-underline dark:text-blue-300"
              >
                {ct('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Plus className="h-5 w-5 text-primary" />
                {t('create')}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setUrl('');
                  setSelectedEvents([]);
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="p-6 space-y-5">
            {/* URL field */}
            <div>
              <label className="text-sm font-medium">{t('url')}</label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">{t('endpointUrlHint')}</p>
              <div className="relative">
                <ExternalLink className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={t('urlPlaceholder')}
                  className={cn(inputClass, 'ps-10')}
                  dir="ltr"
                />
              </div>
            </div>

            {/* Events selection */}
            <div>
              <label className="text-sm font-medium">{t('events')}</label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">{t('eventsHint')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EVENTS.map((event) => {
                  const Icon = EVENT_ICONS[event] || Zap;
                  const isSelected = selectedEvents.includes(event);
                  return (
                    <button
                      key={event}
                      type="button"
                      onClick={() => handleToggleEvent(event)}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 text-start transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'hover:bg-accent hover:border-border/80',
                      )}
                    >
                      <div className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg',
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="min-w-0">
                        <p className={cn('text-sm font-medium', isSelected && 'text-primary')}>
                          {t(`eventTypes.${event.replace(/\./g, '_')}` as any)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t(`eventDescriptions.${event.replace(/\./g, '_')}` as any)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setUrl('');
                  setSelectedEvents([]);
                }}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                {ct('cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!url.trim() || selectedEvents.length === 0 || createWebhook.isPending}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {createWebhook.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {t('create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <p className="font-medium">{ct('somethingWentWrong')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{ct('errorDescription')}</p>
          <button
            onClick={() => refetchWebhooks()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {ct('tryAgain')}
          </button>
        </div>
      ) : !webhooks?.length ? (
        /* Empty state */
        <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Webhook className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{t('noWebhooksTitle')}</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {t('noWebhooksHint')}
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('createFirst')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => {
            const isExpanded = expandedId === webhook.id;
            const isEditing = editingId === webhook.id;
            const showingLogs = logsId === webhook.id;

            return (
              <div
                key={webhook.id}
                className="rounded-xl border bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md"
              >
                {/* Main card header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* URL + status */}
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          webhook.isActive
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : 'bg-muted',
                        )}>
                          <Globe className={cn(
                            'h-4 w-4',
                            webhook.isActive
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-muted-foreground',
                          )} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="block truncate text-sm font-medium" dir="ltr">
                              {webhook.url}
                            </span>
                            <span className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                              webhook.isActive
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-muted text-muted-foreground',
                            )}>
                              {webhook.isActive ? t('active') : t('inactive')}
                            </span>
                          </div>
                          {/* Meta info */}
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {t('lastTriggered')}:{' '}
                              {webhook.lastTriggeredAt
                                ? fmtDate(webhook.lastTriggeredAt, locale)
                                : t('never')}
                            </span>
                            {testStatus?.id === webhook.id && (
                              <span className={cn(
                                'flex items-center gap-1 font-medium',
                                testStatus.type === 'success' ? 'text-green-600' : 'text-red-500',
                              )}>
                                {testStatus.type === 'success' ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                {testStatus.type === 'success' ? t('testSent') : t('testFailed')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Last error */}
                      {webhook.lastError && (
                        <div className="mt-2 ms-10.5 flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span className="truncate">{webhook.lastError}</span>
                        </div>
                      )}

                      {/* Event tags */}
                      <div className="mt-3 flex flex-wrap gap-1.5 ms-10.5">
                        {webhook.events.map((event) => (
                          <span
                            key={event}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary/5 px-2 py-1 text-xs font-medium text-primary"
                          >
                            {t(`eventTypes.${event.replace(/\./g, '_')}` as any)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Expand/collapse button */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : webhook.id)}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded actions & sections */}
                {isExpanded && (
                  <div className="border-t">
                    {/* Action bar */}
                    <div className="flex flex-wrap items-center gap-1 px-5 py-3 bg-muted/50">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(webhook.id, webhook.isActive)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                          webhook.isActive
                            ? 'text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                            : 'text-muted-foreground hover:bg-muted',
                        )}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {webhook.isActive ? t('active') : t('inactive')}
                      </button>
                      <div className="h-4 w-px bg-border" />
                      <button
                        type="button"
                        onClick={() => handleTestWebhook(webhook.id)}
                        disabled={testWebhook.isPending}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                      >
                        {testWebhook.isPending && testWebhook.variables === webhook.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        {t('sendTest')}
                      </button>
                      <div className="h-4 w-px bg-border" />
                      <button
                        type="button"
                        onClick={() => isEditing ? setEditingId(null) : startEditing(webhook)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                          isEditing
                            ? 'text-primary bg-primary/10'
                            : 'text-muted-foreground hover:bg-accent',
                        )}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t('edit')}
                      </button>
                      <div className="h-4 w-px bg-border" />
                      <button
                        type="button"
                        onClick={() => toggleLogs(webhook.id)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                          showingLogs
                            ? 'text-primary bg-primary/10'
                            : 'text-muted-foreground hover:bg-accent',
                        )}
                      >
                        <ScrollText className="h-3.5 w-3.5" />
                        {t('logs')}
                      </button>
                      <div className="h-4 w-px bg-border" />
                      <button
                        type="button"
                        onClick={() => handleRegenerateSecret(webhook.id)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {t('regenerateSecret')}
                      </button>
                      <div className="flex-1" />
                      <button
                        type="button"
                        onClick={() => handleDelete(webhook.id)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('deleteWebhook')}
                      </button>
                    </div>

                    {/* Edit mode */}
                    {isEditing && (
                      <div className="border-t px-5 py-4 space-y-4">
                        <div>
                          <label className="text-sm font-medium">{t('url')}</label>
                          <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">{t('endpointUrlHint')}</p>
                          <div className="relative">
                            <ExternalLink className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                              type="url"
                              value={editUrl}
                              onChange={(e) => setEditUrl(e.target.value)}
                              className={cn(inputClass, 'ps-10')}
                              dir="ltr"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium">{t('events')}</label>
                          <p className="text-xs text-muted-foreground mt-0.5 mb-2">{t('eventsHint')}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {EVENTS.map((event) => {
                              const Icon = EVENT_ICONS[event] || Zap;
                              const isSelected = editEvents.includes(event);
                              return (
                                <button
                                  key={event}
                                  type="button"
                                  onClick={() => handleEditToggleEvent(event)}
                                  className={cn(
                                    'flex items-start gap-3 rounded-lg border p-3 text-start transition-all',
                                    isSelected
                                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                      : 'hover:bg-accent hover:border-border/80',
                                  )}
                                >
                                  <div className={cn(
                                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg',
                                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                                  )}>
                                    <Icon className="h-3 w-3" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className={cn('text-sm font-medium', isSelected && 'text-primary')}>
                                      {t(`eventTypes.${event.replace(/\./g, '_')}` as any)}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {t(`eventDescriptions.${event.replace(/\./g, '_')}` as any)}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-2 border-t">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                          >
                            {ct('cancel')}
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={!editUrl.trim() || editEvents.length === 0 || updateWebhook.isPending}
                            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            {updateWebhook.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            {ct('save')}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Logs section */}
                    {showingLogs && (
                      <div className="border-t px-5 py-4">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <ScrollText className="h-4 w-4 text-primary" />
                          {t('logs')}
                        </h4>
                        {logsLoading ? (
                          <div className="flex justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : !logs?.length ? (
                          <div className="text-center py-6">
                            <ScrollText className="mx-auto h-8 w-8 text-muted-foreground/30" />
                            <p className="text-xs text-muted-foreground mt-2">{t('noLogs')}</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-72 overflow-y-auto">
                            {logs.map((log) => (
                              <div
                                key={log.id}
                                className={cn(
                                  'rounded-lg border px-4 py-3 text-xs',
                                  log.success
                                    ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
                                    : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950',
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <span className={cn(
                                      'inline-flex items-center justify-center rounded-lg px-2 py-0.5 font-mono font-bold',
                                      log.success
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400',
                                    )}>
                                      {log.statusCode ?? '---'}
                                    </span>
                                    <span className="font-medium text-muted-foreground">
                                      {t(`eventTypes.${log.event.replace(/\./g, '_')}` as any)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-muted-foreground">
                                    {log.duration != null && (
                                      <span className="font-mono">{log.duration}ms</span>
                                    )}
                                    <span>{fmtDateTime(log.createdAt, locale)}</span>
                                  </div>
                                </div>
                                {log.error && (
                                  <p className="mt-2 rounded-lg bg-red-100/50 px-2 py-1 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                    {log.error}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog {...confirmProps} />
    </div>
  );
}
