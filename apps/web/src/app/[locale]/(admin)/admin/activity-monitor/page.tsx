'use client';

import { useAdminSocket } from '@/hooks/useAdminSocket';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime, fmtTime } from '@/lib/dateFormat';
import { Radio, Trash2, Zap, Bell, Users, Shield, Settings, AlertTriangle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function typeBadge(type: string, t: ReturnType<typeof useTranslations>) {
  const baseClasses = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium';
  const label = t(`eventTypes.${type?.toLowerCase()}` as any);
  switch (type?.toLowerCase()) {
    case 'auth':
    case 'login':
      return (
        <span className={`${baseClasses} bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400`}>
          <Shield className="h-3 w-3" />
          {label}
        </span>
      );
    case 'user':
      return (
        <span className={`${baseClasses} bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400`}>
          <Users className="h-3 w-3" />
          {label}
        </span>
      );
    case 'system':
    case 'config':
      return (
        <span className={`${baseClasses} bg-muted text-muted-foreground`}>
          <Settings className="h-3 w-3" />
          {label}
        </span>
      );
    case 'error':
      return (
        <span className={`${baseClasses} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`}>
          <AlertTriangle className="h-3 w-3" />
          {label}
        </span>
      );
    case 'webhook':
      return (
        <span className={`${baseClasses} bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400`}>
          <Zap className="h-3 w-3" />
          {label}
        </span>
      );
    case 'notification':
      return (
        <span className={`${baseClasses} bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400`}>
          <Bell className="h-3 w-3" />
          {label}
        </span>
      );
    default:
      return (
        <span className={`${baseClasses} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`}>
          <Zap className="h-3 w-3" />
          {type}
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ActivityMonitorPage() {
  const { events, connected, clearEvents } = useAdminSocket();
  const t = useTranslations('admin.activityMonitor');
  const locale = useLocale();

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              <span className="text-xs text-muted-foreground">
                {connected ? t('connected') : t('disconnected')}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={clearEvents}
          disabled={events.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
        >
          <Trash2 className="h-4 w-4" />
          {t('clearEvents')}
        </button>
      </div>

      {/* Connection warning */}
      {!connected && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center dark:border-yellow-800 dark:bg-yellow-950 mb-6">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            {t('notConnectedWarning')}
          </p>
        </div>
      )}

      {/* Event count */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('eventCount', { count: events.length })}
        </span>
        {events.length >= 200 && (
          <span className="text-xs text-muted-foreground">{t('showingLatest', { count: 200 })}</span>
        )}
      </div>

      {/* Events Feed */}
      <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
        {events.length === 0 && (
          <div className="rounded-xl border bg-card p-16 text-center shadow-sm">
            <Radio className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-sm text-muted-foreground">{t('noEvents')} {t('noEventsDescription')}</p>
          </div>
        )}

        {events.map((event) => (
          <div
            key={event.id}
            className="rounded-xl border bg-card p-4 shadow-sm hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                {typeBadge(event.type, t)}
                <p className="text-sm break-words">{event.message}</p>
              </div>
              <span
                className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0"
                title={fmtDateTime(event.timestamp, locale)}
              >
                {fmtTime(event.timestamp, locale)}
              </span>
            </div>
            {event.metadata && Object.keys(event.metadata).length > 0 && (
              <div className="mt-2 ps-[calc(theme(spacing.3)+theme(spacing.2))]">
                <div className="rounded-lg border bg-background px-3 py-2">
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
