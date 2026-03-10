'use client';

import { useEffect } from 'react';
import { Users, Clock, MessageSquare, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeamPerformanceRealTime } from '@/hooks/useTeamPerformance';
import { useAdminSocket } from '@/hooks/useAdminSocket';

interface RealTimeMetricsProps {
  orgId: string;
}

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border bg-card p-6">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="h-6 w-16 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function RealTimeMetrics({ orgId }: RealTimeMetricsProps) {
  const { data, isLoading } = useTeamPerformanceRealTime(orgId);
  const { teamMetrics, subscribeTeamMetrics, unsubscribeTeamMetrics, connected } = useAdminSocket();

  useEffect(() => {
    if (orgId && connected) {
      subscribeTeamMetrics(orgId);
      return () => unsubscribeTeamMetrics();
    }
  }, [orgId, connected, subscribeTeamMetrics, unsubscribeTeamMetrics]);

  // Use WebSocket data if available, otherwise use polling data
  const metrics = teamMetrics || data;

  const stats = [
    {
      key: 'activeConversations',
      label: 'Active Conversations',
      value: metrics?.activeConversations ?? 0,
      icon: MessageSquare,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      key: 'queueDepth',
      label: 'Queue Depth',
      value: metrics?.queueDepth ?? 0,
      icon: ListOrdered,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
    },
    {
      key: 'averageWaitTime',
      label: 'Avg Wait Time',
      value: metrics?.averageWaitTimeMs ? `${Math.round(metrics.averageWaitTimeMs / 1000)}s` : '0s',
      icon: Clock,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      key: 'agentsOnline',
      label: 'Agents Online',
      value: metrics?.agentsOnline ?? 0,
      icon: Users,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.key} className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-4">
              <div className={cn('rounded-lg p-2.5', stat.bg)}>
                <Icon className={cn('h-5 w-5', stat.color)} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold mt-0.5">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
