'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateShort } from '@/lib/dateFormat';
import { TrendingUp, Calendar } from 'lucide-react';

interface UsageTrendsChartProps {
  aiConversationsUsed: number;
  aiConversationsLimit: number;
}

interface DailyUsage {
  date: string;
  conversations: number;
}

export function UsageTrendsChart({
  aiConversationsUsed,
  aiConversationsLimit,
}: UsageTrendsChartProps) {
  const t = useTranslations('dashboard.billing');
  const locale = useLocale();
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  // Generate mock data based on current usage
  // In a real implementation, this would fetch from an API endpoint
  // GET /api/v1/organizations/:orgId/subscription/usage-trends?groupBy=day
  const generateMockData = (): DailyUsage[] => {
    const data: DailyUsage[] = [];
    const today = new Date();
    const daysToShow = groupBy === 'day' ? 14 : groupBy === 'week' ? 8 : 6;

    // Distribute current usage across the time period with some randomness
    const avgDaily = aiConversationsUsed / daysToShow;

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today);
      if (groupBy === 'day') {
        date.setDate(date.getDate() - i);
      } else if (groupBy === 'week') {
        date.setDate(date.getDate() - (i * 7));
      } else {
        date.setMonth(date.getMonth() - i);
      }

      // Add some variance to make it look realistic
      const variance = 0.3;
      const randomFactor = 1 + (Math.random() * variance * 2 - variance);
      const conversations = Math.max(0, Math.round(avgDaily * randomFactor));

      data.push({
        date: date.toISOString(),
        conversations,
      });
    }

    return data;
  };

  const usageData = generateMockData();
  const maxUsage = Math.max(...usageData.map((d) => d.conversations), 1);

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('usageTrends')}</h2>
            <p className="text-sm text-muted-foreground">{t('usageTrendsSubtitle')}</p>
          </div>
        </div>

        {/* Time period selector */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
          <button
            onClick={() => setGroupBy('day')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              groupBy === 'day'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('daily')}
          </button>
          <button
            onClick={() => setGroupBy('week')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              groupBy === 'week'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('weekly')}
          </button>
          <button
            onClick={() => setGroupBy('month')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              groupBy === 'month'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('monthly')}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="space-y-1">
        {usageData.map((item, idx) => {
          const percentage = maxUsage > 0 ? (item.conversations / maxUsage) * 100 : 0;
          const isOverLimit = item.conversations > (aiConversationsLimit / usageData.length);

          return (
            <div
              key={idx}
              className="group flex items-center gap-3 rounded-lg hover:bg-muted/50 p-2 transition-colors"
            >
              {/* Date label */}
              <div className="w-20 text-xs text-muted-foreground font-medium">
                {fmtDateShort(item.date, locale)}
              </div>

              {/* Bar */}
              <div className="flex-1 relative h-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="h-6 w-full rounded bg-muted">
                    <div
                      className={`h-6 rounded transition-all ${
                        isOverLimit
                          ? 'bg-red-500 dark:bg-red-600'
                          : 'bg-primary dark:bg-primary'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {/* Tooltip on hover */}
                <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="bg-popover text-popover-foreground border shadow-lg rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap">
                    {item.conversations} {t('aiConversations')}
                  </div>
                </div>
              </div>

              {/* Count */}
              <div className="w-12 text-right text-sm font-medium">
                {item.conversations}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-6 border-t flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            {groupBy === 'day' && t('last14Days')}
            {groupBy === 'week' && t('last8Weeks')}
            {groupBy === 'month' && t('last6Months')}
          </span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">{t('total')}: </span>
          <span className="font-semibold">{aiConversationsUsed}</span>
          <span className="text-muted-foreground"> / {aiConversationsLimit}</span>
        </div>
      </div>
    </div>
  );
}
