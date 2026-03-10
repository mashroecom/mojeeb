'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, MessageSquare, Bot, Zap, Plug } from 'lucide-react';
import type { Subscription } from '@/hooks/useSubscription';

interface UsageAlertsSectionProps {
  subscription: Subscription | null | undefined;
}

interface UsageMetric {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  used: number;
  limit: number;
  percentage: number;
  color: string;
  bg: string;
}

export function UsageAlertsSection({ subscription }: UsageAlertsSectionProps) {
  const t = useTranslations('dashboard.billing');

  if (!subscription) return null;

  // Calculate usage metrics
  const metrics: UsageMetric[] = [
    {
      label: t('messages'),
      icon: MessageSquare,
      used: subscription.messagesUsed,
      limit: subscription.messagesLimit,
      percentage:
        subscription.messagesLimit > 0
          ? Math.round((subscription.messagesUsed / subscription.messagesLimit) * 100)
          : 0,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      label: t('agents'),
      icon: Bot,
      used: subscription.agentsUsed,
      limit: subscription.agentsLimit,
      percentage:
        subscription.agentsLimit > 0
          ? Math.round((subscription.agentsUsed / subscription.agentsLimit) * 100)
          : 0,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
    {
      label: t('aiConversations'),
      icon: Zap,
      used: subscription.aiConversationsUsed,
      limit: subscription.aiConversationsLimit,
      percentage:
        subscription.aiConversationsLimit > 0
          ? Math.round((subscription.aiConversationsUsed / subscription.aiConversationsLimit) * 100)
          : 0,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      label: t('integrations'),
      icon: Plug,
      used: subscription.integrationsUsed,
      limit: subscription.integrationsLimit,
      percentage:
        subscription.integrationsLimit > 0
          ? Math.round((subscription.integrationsUsed / subscription.integrationsLimit) * 100)
          : 0,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
    },
  ];

  // Filter to only show alerts for usage > 80%
  const alerts = metrics.filter((metric) => metric.percentage >= 80);

  // Don't render anything if no alerts
  if (alerts.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t('usageAlerts')}</h2>
          <p className="text-sm text-muted-foreground">{t('usageAlertsSubtitle')}</p>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.map((metric) => {
          const isAtLimit = metric.percentage >= 100;
          const isWarning = metric.percentage >= 80 && metric.percentage < 100;

          return (
            <div
              key={metric.label}
              className={`flex items-start gap-3 rounded-lg border-2 p-4 ${
                isAtLimit
                  ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                  : isWarning
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                    : ''
              }`}
            >
              <div
                className={`rounded-lg p-2 ${
                  isAtLimit ? 'bg-red-100 dark:bg-red-900/40' : 'bg-amber-100 dark:bg-amber-900/40'
                }`}
              >
                <metric.icon
                  className={`h-5 w-5 ${
                    isAtLimit
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold">{metric.label}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      isAtLimit
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}
                  >
                    {metric.percentage}%
                  </span>
                </div>

                <p
                  className={`text-sm ${
                    isAtLimit
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {isAtLimit
                    ? t('usageAlertAtLimit', {
                        used: metric.used,
                        limit: metric.limit,
                      })
                    : t('usageAlertWarning', {
                        used: metric.used,
                        limit: metric.limit,
                        percentage: metric.percentage,
                      })}
                </p>

                {/* Progress bar */}
                <div className="mt-2 h-2 w-full rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      isAtLimit ? 'bg-red-500 dark:bg-red-600' : 'bg-amber-500 dark:bg-amber-600'
                    }`}
                    style={{ width: `${Math.min(100, metric.percentage)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info footer for overage charges if applicable */}
      {subscription.plan !== 'FREE' && alerts.some((a) => a.label === t('aiConversations')) && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground">{t('usageAlertsOverageNote')}</p>
        </div>
      )}
    </div>
  );
}
