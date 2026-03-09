'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Calendar,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeamPerformanceHistorical, useAiVsHuman } from '@/hooks/useTeamPerformance';

interface TeamPerformanceCardProps {
  orgId: string;
  startDate?: string;
  endDate?: string;
}

interface AgentMetric {
  agentId: string;
  agentName: string;
  conversationsHandled: number;
  avgResponseTimeMs: number;
  avgResolutionTimeMs: number;
  avgCSAT: number;
  handoffCount: number;
  messageCount: number;
}

type SortKey = keyof AgentMetric;
type SortOrder = 'asc' | 'desc';
type ConversationType = 'ALL' | 'AI' | 'HUMAN';

const CHANNEL_OPTIONS = ['all', 'email', 'chat', 'sms', 'whatsapp'] as const;
type Channel = (typeof CHANNEL_OPTIONS)[number];

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function TeamPerformanceCard({ orgId, startDate, endDate }: TeamPerformanceCardProps) {
  const [sortKey, setSortKey] = useState<SortKey>('conversationsHandled');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [channel, setChannel] = useState<Channel>('all');
  const [showComparison, setShowComparison] = useState(false);

  // Fetch historical data
  const { data: historicalData, isLoading: loadingHistorical } = useTeamPerformanceHistorical({
    orgId,
    startDate,
    endDate,
    channel: channel === 'all' ? undefined : channel,
  });

  // Fetch AI vs Human comparison
  const { data: comparisonData, isLoading: loadingComparison } = useAiVsHuman(
    showComparison
      ? {
          orgId,
          startDate,
          endDate,
          channel: channel === 'all' ? undefined : channel,
        }
      : undefined
  );

  const agentMetrics: AgentMetric[] = historicalData?.agentMetrics ?? [];

  // Sort the agent metrics
  const sortedMetrics = useMemo(() => {
    const sorted = [...agentMetrics];
    sorted.sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      const aNum = Number(aValue) || 0;
      const bNum = Number(bValue) || 0;
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    });
    return sorted;
  }, [agentMetrics, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    );
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Table className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Historical Performance Metrics</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Channel Filter */}
          <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              className="text-xs font-medium bg-transparent border-none outline-none cursor-pointer"
            >
              {CHANNEL_OPTIONS.map((ch) => (
                <option key={ch} value={ch}>
                  {ch.charAt(0).toUpperCase() + ch.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* AI vs Human Toggle */}
          <button
            onClick={() => setShowComparison(!showComparison)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
              showComparison
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            AI vs Human
          </button>
        </div>
      </div>

      {/* AI vs Human Comparison Section */}
      {showComparison && (
        <div className="mb-6 rounded-lg border bg-muted/30 p-4">
          {loadingComparison ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : comparisonData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* AI Metrics */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  AI Performance
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Conversations:</span>
                    <span className="font-medium">
                      {(comparisonData.ai?.conversationCount ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Response:</span>
                    <span className="font-medium">
                      {formatTime(comparisonData.ai?.avgResponseTimeMs ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Resolution:</span>
                    <span className="font-medium">
                      {formatTime(comparisonData.ai?.avgResolutionTimeMs ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CSAT:</span>
                    <span className="font-medium">
                      {(comparisonData.ai?.avgCSAT ?? 0).toFixed(2)} / 5
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolution Rate:</span>
                    <span className="font-medium">
                      {((comparisonData.ai?.resolutionRate ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Human Metrics */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                  Human Performance
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Conversations:</span>
                    <span className="font-medium">
                      {(comparisonData.human?.conversationCount ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Response:</span>
                    <span className="font-medium">
                      {formatTime(comparisonData.human?.avgResponseTimeMs ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Resolution:</span>
                    <span className="font-medium">
                      {formatTime(comparisonData.human?.avgResolutionTimeMs ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CSAT:</span>
                    <span className="font-medium">
                      {(comparisonData.human?.avgCSAT ?? 0).toFixed(2)} / 5
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolution Rate:</span>
                    <span className="font-medium">
                      {((comparisonData.human?.resolutionRate ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No comparison data available
            </p>
          )}
        </div>
      )}

      {/* Table */}
      {loadingHistorical ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sortedMetrics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">No agent performance data available</p>
          <p className="text-xs mt-1">Try adjusting the date range or filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left pb-3 pr-4">
                  <button
                    onClick={() => handleSort('agentName')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold"
                  >
                    Agent Name
                    <SortIcon columnKey="agentName" />
                  </button>
                </th>
                <th className="text-right pb-3 pr-4">
                  <button
                    onClick={() => handleSort('conversationsHandled')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors font-semibold"
                  >
                    Conversations
                    <SortIcon columnKey="conversationsHandled" />
                  </button>
                </th>
                <th className="text-right pb-3 pr-4">
                  <button
                    onClick={() => handleSort('avgResponseTimeMs')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors font-semibold whitespace-nowrap"
                  >
                    Avg Response
                    <SortIcon columnKey="avgResponseTimeMs" />
                  </button>
                </th>
                <th className="text-right pb-3 pr-4">
                  <button
                    onClick={() => handleSort('avgResolutionTimeMs')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors font-semibold whitespace-nowrap"
                  >
                    Avg Resolution
                    <SortIcon columnKey="avgResolutionTimeMs" />
                  </button>
                </th>
                <th className="text-right pb-3 pr-4">
                  <button
                    onClick={() => handleSort('avgCSAT')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors font-semibold"
                  >
                    CSAT
                    <SortIcon columnKey="avgCSAT" />
                  </button>
                </th>
                <th className="text-right pb-3">
                  <button
                    onClick={() => handleSort('handoffCount')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors font-semibold"
                  >
                    Handoffs
                    <SortIcon columnKey="handoffCount" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedMetrics.map((agent) => (
                <tr
                  key={agent.agentId}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 pr-4">
                    <div className="flex flex-col">
                      <span className="font-medium">{agent.agentName || 'Unknown Agent'}</span>
                      <span className="text-xs text-muted-foreground">ID: {agent.agentId}</span>
                    </div>
                  </td>
                  <td className="text-right py-3 pr-4 font-medium">
                    {(agent.conversationsHandled ?? 0).toLocaleString()}
                  </td>
                  <td className="text-right py-3 pr-4 font-mono text-xs">
                    {formatTime(agent.avgResponseTimeMs ?? 0)}
                  </td>
                  <td className="text-right py-3 pr-4 font-mono text-xs">
                    {formatTime(agent.avgResolutionTimeMs ?? 0)}
                  </td>
                  <td className="text-right py-3 pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-medium">{(agent.avgCSAT ?? 0).toFixed(2)}</span>
                      <span className="text-muted-foreground">/ 5</span>
                    </div>
                  </td>
                  <td className="text-right py-3 font-medium">
                    {(agent.handoffCount ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary Stats */}
          {historicalData && (
            <div className="mt-6 pt-6 border-t">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Conversations</p>
                  <p className="text-lg font-bold">
                    {(historicalData.totalConversations ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Avg Response</p>
                  <p className="text-lg font-bold font-mono">
                    {formatTime(historicalData.avgResponseTimeMs ?? 0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Avg Resolution</p>
                  <p className="text-lg font-bold font-mono">
                    {formatTime(historicalData.avgResolutionTimeMs ?? 0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Avg CSAT</p>
                  <p className="text-lg font-bold">
                    {(historicalData.avgCSAT ?? 0).toFixed(2)} / 5
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Handoffs</p>
                  <p className="text-lg font-bold">
                    {(historicalData.handoffCount ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Handoff Rate</p>
                  <p className="text-lg font-bold">
                    {((historicalData.handoffRate ?? 0) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
