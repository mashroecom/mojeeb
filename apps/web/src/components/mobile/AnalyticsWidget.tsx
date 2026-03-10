'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface AnalyticsWidgetProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
  isLoading?: boolean;
  subtitle?: string;
}

export function AnalyticsWidget({
  title,
  value,
  icon: Icon,
  color,
  bg,
  isLoading,
  subtitle,
}: AnalyticsWidgetProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-6 w-16 rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 transition-colors active:bg-muted/50">
      <div className="flex items-center gap-3">
        <div className={cn('rounded-lg p-3', bg)}>
          <Icon className={cn('h-6 w-6', color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate mb-0.5">{title}</p>
          <p className="text-xl font-bold truncate">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChartWidgetProps {
  title: string;
  icon: LucideIcon;
  isLoading?: boolean;
  children: React.ReactNode;
}

export function ChartWidget({ title, icon: Icon, isLoading, children }: ChartWidgetProps) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
}

export function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
