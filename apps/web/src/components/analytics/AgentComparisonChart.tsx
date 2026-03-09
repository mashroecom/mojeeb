'use client';

import { Loader2, BarChart3, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentComparison } from '@/hooks/useTeamPerformance';

interface AgentComparisonChartProps {
  agentIds: string[];
  dateRange?: {
    startDate?: string;
    endDate?: string;
    orgId?: string;
  };
}

interface AgentMetrics {
  agentId: string;
  agentName: string;
  totalConversations: number;
  totalMessages: number;
  averageResponseTimeMs: number;
  resolutionRate: number;
  satisfactionScore: number;
}

const METRIC_COLORS = [
  { key: 'totalConversations', label: 'Conversations', color: 'bg-blue-500 dark:bg-blue-400' },
  { key: 'totalMessages', label: 'Messages', color: 'bg-purple-500 dark:bg-purple-400' },
  { key: 'resolutionRate', label: 'Resolution Rate', color: 'bg-green-500 dark:bg-green-400' },
  { key: 'satisfactionScore', label: 'Satisfaction', color: 'bg-orange-500 dark:bg-orange-400' },
];

export function AgentComparisonChart({ agentIds, dateRange }: AgentComparisonChartProps) {
  const { data, isLoading } = useAgentComparison(agentIds, dateRange);

  const agents: AgentMetrics[] = data?.agents ?? [];

  // Calculate max values for each metric to normalize the bars
  const maxValues = {
    totalConversations: Math.max(...agents.map((a) => a.totalConversations ?? 0), 1),
    totalMessages: Math.max(...agents.map((a) => a.totalMessages ?? 0), 1),
    resolutionRate: 100, // percentage
    satisfactionScore: 5, // out of 5
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">No agents selected for comparison</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Agent Performance Comparison</h2>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-6 text-xs">
        {METRIC_COLORS.map((metric) => (
          <div key={metric.key} className="flex items-center gap-1.5">
            <div className={cn('h-3 w-3 rounded-sm', metric.color)} />
            <span className="text-muted-foreground">{metric.label}</span>
          </div>
        ))}
      </div>

      {/* Agent Comparison Chart */}
      <div className="space-y-6">
        {agents.map((agent) => (
          <div key={agent.agentId} className="space-y-3">
            {/* Agent Name */}
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">{agent.agentName || 'Unknown Agent'}</h3>
              <span className="text-xs text-muted-foreground">ID: {agent.agentId}</span>
            </div>

            {/* Metrics Bars */}
            <div className="space-y-2">
              {/* Conversations */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Conversations</span>
                  <span className="font-medium">{(agent.totalConversations ?? 0).toLocaleString()}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', METRIC_COLORS[0].color)}
                    style={{
                      width: `${((agent.totalConversations ?? 0) / maxValues.totalConversations) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Messages</span>
                  <span className="font-medium">{(agent.totalMessages ?? 0).toLocaleString()}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', METRIC_COLORS[1].color)}
                    style={{
                      width: `${((agent.totalMessages ?? 0) / maxValues.totalMessages) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Resolution Rate */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Resolution Rate</span>
                  <span className="font-medium">{(agent.resolutionRate ?? 0).toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', METRIC_COLORS[2].color)}
                    style={{
                      width: `${((agent.resolutionRate ?? 0) / maxValues.resolutionRate) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Satisfaction Score */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Satisfaction</span>
                  <span className="font-medium">{(agent.satisfactionScore ?? 0).toFixed(2)} / 5</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', METRIC_COLORS[3].color)}
                    style={{
                      width: `${((agent.satisfactionScore ?? 0) / maxValues.satisfactionScore) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      {agents.length > 1 && (
        <div className="mt-6 pt-6 border-t">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Avg Conversations</p>
              <p className="text-lg font-bold">
                {Math.round(
                  agents.reduce((sum, a) => sum + (a.totalConversations ?? 0), 0) / agents.length
                ).toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Avg Messages</p>
              <p className="text-lg font-bold">
                {Math.round(
                  agents.reduce((sum, a) => sum + (a.totalMessages ?? 0), 0) / agents.length
                ).toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Avg Resolution</p>
              <p className="text-lg font-bold">
                {(
                  agents.reduce((sum, a) => sum + (a.resolutionRate ?? 0), 0) / agents.length
                ).toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Avg Satisfaction</p>
              <p className="text-lg font-bold">
                {(
                  agents.reduce((sum, a) => sum + (a.satisfactionScore ?? 0), 0) / agents.length
                ).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
