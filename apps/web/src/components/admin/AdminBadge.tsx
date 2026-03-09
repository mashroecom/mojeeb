'use client';
import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'default';

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  error: 'bg-destructive/10 text-destructive',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  default: 'bg-muted text-muted-foreground',
};

interface AdminBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function AdminBadge({ variant = 'default', children, className }: AdminBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
