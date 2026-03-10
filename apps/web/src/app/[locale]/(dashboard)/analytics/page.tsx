'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateShort } from '@/lib/dateFormat';
import {
  useAnalyticsOverview,
  useConversationMetrics,
  useAgentPerformance,
  useChannelBreakdown,
  useLeadFunnel,
  useCsatTrends,
  useResponseTimeTrends,
} from '@/hooks/useAnalytics';
import { useLeadStats } from '@/hooks/useLeads';
import { exportToCsv } from '@/lib/exportCsv';
import {
  MessageSquare,
  Mail,
  Users,
  Activity,
  CheckCircle,
  Clock,
  ArrowRightLeft,
  Download,
  Calendar,
} from 'lucide-react';

export default function AnalyticsPage() {
  const t = useTranslations('dashboard.analytics');
  const locale = useLocale();
  const tLeads = useTranslations('dashboard.leads');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: overview, isLoading: loadingOverview } = useAnalyticsOverview();
  const { data: leadStats, isLoading: loadingLeads } = useLeadStats();
  const { data: conversationMetrics, isLoading: loadingMetrics } = useConversationMetrics({
    groupBy: 'day',
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });
  const { data: agentPerformance, isLoading: loadingAgents } = useAgentPerformance();
  const { data: channelBreakdown, isLoading: loadingChannels } = useChannelBreakdown();
  const { data: leadFunnel, isLoading: loadingFunnel } = useLeadFunnel();
  const { data: csatTrends, isLoading: loadingCsat } = useCsatTrends({
    groupBy: 'day',
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });
  const { data: responseTimeTrends, isLoading: loadingResponseTime } = useResponseTimeTrends({
    groupBy: 'day',
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const isLoading = loadingOverview || loadingLeads;

  function formatResponseTime(ms: number): string {
    if (ms < 1000) return `${ms} ${t('ms')}`;
    return `${(ms / 1000).toFixed(1)}${t('seconds')}`;
  }

  const stats = [
    {
      label: t('totalConversations'),
      value: overview?.totalConversations ?? 0,
      icon: MessageSquare,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: t('totalMessages'),
      value: overview?.totalMessages ?? 0,
      icon: Mail,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    },
    {
      label: t('totalLeads'),
      value: overview?.totalLeads ?? 0,
      icon: Users,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: t('activeConversations'),
      value: overview?.activeConversations ?? 0,
      icon: Activity,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
    },
    {
      label: t('resolvedConversations'),
      value: overview?.resolvedConversations ?? 0,
      icon: CheckCircle,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
    {
      label: t('avgResponseTime'),
      value: formatResponseTime(overview?.averageResponseTimeMs ?? 0),
      icon: Clock,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      isText: true,
    },
    {
      label: t('handoffRate'),
      value: `${Math.round((overview?.handoffRate ?? 0) * 100)}%`,
      icon: ArrowRightLeft,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/30',
      isText: true,
    },
  ];

  const leadStatuses = [
    { key: 'new' as const, label: tLeads('statusNew'), color: 'bg-blue-500' },
    { key: 'contacted' as const, label: tLeads('statusContacted'), color: 'bg-yellow-500' },
    { key: 'qualified' as const, label: tLeads('statusQualified'), color: 'bg-purple-500' },
    { key: 'converted' as const, label: tLeads('statusConverted'), color: 'bg-green-500' },
    { key: 'lost' as const, label: tLeads('statusLost'), color: 'bg-red-500' },
  ];

  // Compute max conversation count for bar chart scaling
  const maxConversations = conversationMetrics?.metrics?.length
    ? Math.max(...conversationMetrics.metrics.map((m) => m.conversations), 1)
    : 1;

  // Compute max channel conversations for horizontal bar scaling
  const maxChannelConversations = channelBreakdown?.channels?.length
    ? Math.max(...channelBreakdown.channels.map((c) => c.conversations), 1)
    : 1;

  // Funnel colors
  const funnelColors = ['bg-blue-500', 'bg-yellow-500', 'bg-purple-500', 'bg-green-500'];
  const funnelStageLabels: Record<string, string> = {
    NEW: tLeads('statusNew'),
    CONTACTED: tLeads('statusContacted'),
    QUALIFIED: tLeads('statusQualified'),
    CONVERTED: tLeads('statusConverted'),
  };

  function handleExportCsv() {
    if (!agentPerformance?.agents?.length) return;
    const rows = agentPerformance.agents.map((agent) => ({
      [t('agent')]: agent.name,
      [t('conversations')]: agent.conversations,
      [t('messages')]: agent.messages,
      [t('resolved')]: agent.resolved,
      [t('responseTime')]: formatResponseTime(agent.averageResponseTimeMs),
    }));
    exportToCsv('agent-performance', rows);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Date Range Picker & Export */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 rounded-lg border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            placeholder={t('startDate')}
          />
          <span className="text-muted-foreground text-sm">{t('to')}</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 rounded-lg border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            placeholder={t('endDate')}
          />
        </div>
        <button
          onClick={handleExportCsv}
          disabled={!agentPerformance?.agents?.length}
          className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" />
          {t('export')}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-5 shadow-sm">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-4 w-24 rounded bg-muted mb-3" />
                <div className="h-8 w-16 rounded bg-muted" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <div className={`rounded-lg p-2 ${stat.bg}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold">
                  {stat.isText ? stat.value : Number(stat.value).toLocaleString(locale)}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Conversations Over Time */}
      <div className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">{t('conversationsOverTime')}</h2>
        {loadingMetrics ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-40 rounded bg-muted" />
          </div>
        ) : conversationMetrics?.metrics && conversationMetrics.metrics.length > 0 ? (
          <div className="flex items-end gap-1.5 h-48 overflow-x-auto pb-2">
            {conversationMetrics.metrics.map((metric) => {
              const heightPercent = (metric.conversations / maxConversations) * 100;
              return (
                <div
                  key={metric.date}
                  className="flex flex-col items-center flex-1 min-w-[32px] group"
                >
                  <div className="relative w-full flex justify-center flex-1 items-end">
                    <span className="absolute -top-6 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {metric.conversations}
                    </span>
                    <div
                      className="w-full max-w-[40px] rounded-t bg-blue-500 dark:bg-blue-400 transition-all hover:bg-blue-600 dark:hover:bg-blue-300"
                      style={{ height: `${Math.max(heightPercent, 2)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1.5 truncate w-full text-center">
                    {fmtDateShort(metric.date, locale)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t('noConversationMetrics')}
          </p>
        )}
      </div>

      {/* Agent Performance & Channel Breakdown - side by side on large screens */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Agent Performance Table */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">{t('agentPerformance')}</h2>
          {loadingAgents ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 rounded bg-muted" />
              ))}
            </div>
          ) : agentPerformance?.agents && agentPerformance.agents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-start pb-3 font-medium">{t('agent')}</th>
                    <th className="text-start pb-3 font-medium">{t('conversations')}</th>
                    <th className="text-start pb-3 font-medium">{t('messages')}</th>
                    <th className="text-start pb-3 font-medium">{t('resolved')}</th>
                    <th className="text-start pb-3 font-medium">{t('responseTime')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {agentPerformance.agents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-muted/50 transition-colors">
                      <td className="py-3 font-medium">{agent.name}</td>
                      <td className="py-3">{agent.conversations.toLocaleString(locale)}</td>
                      <td className="py-3">{agent.messages.toLocaleString(locale)}</td>
                      <td className="py-3">{agent.resolved.toLocaleString(locale)}</td>
                      <td className="py-3">{formatResponseTime(agent.averageResponseTimeMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{t('noAgents')}</p>
          )}
        </div>

        {/* Channel Breakdown - Horizontal Bars */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">{t('channelBreakdown')}</h2>
          {loadingChannels ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 rounded bg-muted" />
              ))}
            </div>
          ) : channelBreakdown?.channels && channelBreakdown.channels.length > 0 ? (
            <div className="space-y-4">
              {channelBreakdown.channels.map((ch, index) => {
                const widthPercent = (ch.conversations / maxChannelConversations) * 100;
                const colors = [
                  'bg-blue-500',
                  'bg-green-500',
                  'bg-purple-500',
                  'bg-orange-500',
                  'bg-pink-500',
                  'bg-cyan-500',
                ];
                const barColor = colors[index % colors.length];
                return (
                  <div key={ch.channel}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium capitalize">{ch.channel}</span>
                      <span className="text-muted-foreground">
                        {ch.conversations.toLocaleString(locale)} {t('conversations').toLowerCase()}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-muted">
                      <div
                        className={`h-3 rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.max(widthPercent, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{t('noChannels')}</p>
          )}
        </div>
      </div>

      {/* Lead Funnel & Lead Status Breakdown - side by side on large screens */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lead Funnel */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">{t('leadFunnel')}</h2>
          {loadingFunnel ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded bg-muted" />
              ))}
            </div>
          ) : leadFunnel?.funnel && leadFunnel.funnel.length > 0 ? (
            <div className="flex flex-col items-center gap-2 py-4">
              {leadFunnel.funnel.map((stage, index) => {
                // Funnel narrows progressively: first item is widest, last is narrowest
                const widthPercent = 100 - (index / Math.max(leadFunnel.funnel.length - 1, 1)) * 50;
                const color = funnelColors[index % funnelColors.length];
                const label = funnelStageLabels[stage.stage.toUpperCase()] || stage.stage;
                return (
                  <div key={stage.stage} className="w-full flex flex-col items-center">
                    <div
                      className={`${color} rounded-lg py-3 px-4 text-white text-center transition-all relative`}
                      style={{ width: `${widthPercent}%` }}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{label}</span>
                        <span className="font-semibold">
                          {stage.count.toLocaleString(locale)} ({stage.percentage}%)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{t('noFunnelData')}</p>
          )}
        </div>

        {/* Lead Status Breakdown */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">{t('leadBreakdown')}</h2>
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-6 rounded bg-muted" />
              ))}
            </div>
          ) : leadStats && leadStats.total > 0 ? (
            <div className="space-y-4">
              {leadStatuses.map((status) => {
                const count = leadStats[status.key] || 0;
                const percentage =
                  leadStats.total > 0 ? Math.round((count / leadStats.total) * 100) : 0;
                return (
                  <div key={status.key}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium">{status.label}</span>
                      <span className="text-muted-foreground">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted">
                      <div
                        className={`h-2.5 rounded-full transition-all ${status.color}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{t('noData')}</p>
          )}
        </div>
      </div>

      {/* CSAT Trends & Response Time Trends - side by side on large screens */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Customer Satisfaction Trends */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">{t('csatTrends')}</h2>
          {loadingCsat ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-40 rounded bg-muted" />
            </div>
          ) : csatTrends?.trends && csatTrends.trends.length > 0 ? (
            <div className="space-y-2">
              {/* Rating scale labels */}
              <div className="flex items-end gap-1.5 h-48 overflow-x-auto pb-2">
                {csatTrends.trends.map((point) => {
                  const heightPercent = (point.avgRating / 5) * 100;
                  const ratingColor =
                    point.avgRating >= 4
                      ? 'bg-green-500 dark:bg-green-400'
                      : point.avgRating >= 3
                        ? 'bg-yellow-500 dark:bg-yellow-400'
                        : 'bg-red-500 dark:bg-red-400';
                  return (
                    <div
                      key={point.date}
                      className="flex flex-col items-center flex-1 min-w-[32px] group"
                    >
                      <div className="relative w-full flex justify-center flex-1 items-end">
                        <span className="absolute -top-6 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {point.avgRating.toFixed(1)} ({point.count})
                        </span>
                        <div
                          className={`w-full max-w-[40px] rounded-t transition-all hover:opacity-80 ${ratingColor}`}
                          style={{ height: `${Math.max(heightPercent, 4)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1.5 truncate w-full text-center">
                        {fmtDateShort(point.date, locale)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-green-500" /> 4-5
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" /> 3-4
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500" /> 1-3
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{t('noData')}</p>
          )}
        </div>

        {/* Response Time Trends */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">{t('responseTimeTrends')}</h2>
          {loadingResponseTime ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-40 rounded bg-muted" />
            </div>
          ) : responseTimeTrends?.trends && responseTimeTrends.trends.length > 0 ? (
            (() => {
              const maxMs = Math.max(
                ...responseTimeTrends.trends.map((p) => p.avgResponseTimeMs),
                1,
              );
              return (
                <div className="flex items-end gap-1.5 h-48 overflow-x-auto pb-2">
                  {responseTimeTrends.trends.map((point) => {
                    const heightPercent = (point.avgResponseTimeMs / maxMs) * 100;
                    return (
                      <div
                        key={point.date}
                        className="flex flex-col items-center flex-1 min-w-[32px] group"
                      >
                        <div className="relative w-full flex justify-center flex-1 items-end">
                          <span className="absolute -top-6 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {formatResponseTime(point.avgResponseTimeMs)}
                          </span>
                          <div
                            className="w-full max-w-[40px] rounded-t bg-purple-500 dark:bg-purple-400 transition-all hover:bg-purple-600 dark:hover:bg-purple-300"
                            style={{ height: `${Math.max(heightPercent, 2)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1.5 truncate w-full text-center">
                          {fmtDateShort(point.date, locale)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{t('noData')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
