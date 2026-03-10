'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAnalyticsOverview } from '@/hooks/useAnalytics';
import { useConversations } from '@/hooks/useConversations';
import { cn } from '@/lib/utils';
import { MessageSquare, Mail, Users, Clock, Bot, ArrowRight, Loader2 } from 'lucide-react';
import { GettingStartedCard } from '@/components/dashboard/GettingStartedCard';

function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function useTimeAgo() {
  const t = useTranslations('dashboard.overview');
  return (date: string): string => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('timeJustNow');
    if (mins < 60) return t('timeMinAgo', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('timeHourAgo', { count: hours });
    const days = Math.floor(hours / 24);
    return t('timeDayAgo', { count: days });
  };
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  HANDED_OFF: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  WAITING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  RESOLVED: 'bg-muted text-muted-foreground',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

export default function DashboardPage() {
  const t = useTranslations('dashboard.overview');
  const timeAgo = useTimeAgo();
  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview();
  const { data: conversations, isLoading: convsLoading } = useConversations({ limit: 5 });

  const stats = [
    {
      label: t('totalConversations'),
      value: overview?.totalConversations ?? 0,
      icon: MessageSquare,
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    },
    {
      label: t('totalMessages'),
      value: overview?.totalMessages ?? 0,
      icon: Mail,
      color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
    },
    {
      label: t('activeLeads'),
      value: overview?.totalLeads ?? 0,
      icon: Users,
      color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400',
    },
    {
      label: t('avgResponseTime'),
      value: overview ? formatResponseTime(overview.averageResponseTimeMs) : '—',
      icon: Clock,
      color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* Getting Started Checklist */}
      <GettingStartedCard />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5 flex items-start gap-4">
            <div className={cn('rounded-lg p-2.5', s.color)}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              {overviewLoading ? (
                <div className="h-7 w-16 rounded bg-muted animate-pulse" />
              ) : (
                <p className="text-2xl font-bold">{s.value}</p>
              )}
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/agents/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Bot className="h-4 w-4" />
          {t('createAgent')}
        </Link>
        <Link
          href="/conversations"
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
          {t('viewConversations')}
        </Link>
      </div>

      {/* Recent Conversations */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{t('recentConversations')}</h2>
          <Link
            href="/conversations"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            {t('viewConversations')}
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </div>

        {convsLoading ? (
          <div className="flex items-center justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !conversations?.data?.length ? (
          <div className="p-10 text-center text-muted-foreground">{t('noConversationsYet')}</div>
        ) : (
          <div className="divide-y">
            {conversations.data.map((conv) => (
              <Link
                key={conv.id}
                href={`/conversations?id=${conv.id}`}
                className="flex items-center justify-between p-4 hover:bg-accent/50 transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{conv.customerName || t('guestUser')}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {conv.messages?.[0]?.content || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3 ms-4 shrink-0">
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      STATUS_COLORS[conv.status] || STATUS_COLORS.ACTIVE,
                    )}
                  >
                    {t(`status${conv.status}`)}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
