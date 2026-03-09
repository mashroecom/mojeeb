'use client';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  iconColor?: string;
  loading?: boolean;
}

export function AdminStatCard({ icon: Icon, label, value, iconColor = 'text-primary', loading }: AdminStatCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm animate-pulse">
        <div className="h-3 w-20 rounded bg-muted mb-3" />
        <div className="h-7 w-16 rounded bg-muted" />
      </div>
    );
  }
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        <Icon className={cn('h-4 w-4', iconColor)} />
        {label}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
