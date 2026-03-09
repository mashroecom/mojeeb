'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {onRetry && retryLabel && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
