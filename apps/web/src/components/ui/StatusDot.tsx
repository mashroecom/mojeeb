'use client';

import { cn } from '@/lib/utils';
import { Tooltip } from './Tooltip';

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-gray-400 dark:bg-gray-600',
  active: 'bg-blue-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
} as const;

const statusLabels = {
  online: 'Online',
  offline: 'Offline',
  active: 'Active',
  warning: 'Warning',
  error: 'Error',
} as const;

const sizeStyles = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
} as const;

export interface StatusDotProps {
  status: keyof typeof statusColors;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusDot({
  status,
  size = 'md',
  className,
}: StatusDotProps) {
  return (
    <Tooltip content={statusLabels[status]}>
      <span
        className={cn(
          'inline-block shrink-0 rounded-full',
          statusColors[status],
          sizeStyles[size],
          className,
        )}
        role="status"
        aria-label={status}
      />
    </Tooltip>
  );
}
