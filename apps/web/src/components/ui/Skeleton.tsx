'use client';

import { cn } from '@/lib/utils';

/* -------------------------------- Skeleton -------------------------------- */

export interface SkeletonProps {
  variant?: 'text' | 'circle' | 'card' | 'rect';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className,
}: SkeletonProps) {
  const variantStyles = {
    text: 'h-4 w-full rounded',
    circle: 'h-10 w-10 rounded-full',
    card: 'h-32 w-full rounded-lg',
    rect: 'h-20 w-full rounded-md',
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-muted',
        variantStyles[variant],
        className,
      )}
      style={{
        ...(width != null ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
        ...(height != null ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
      }}
    />
  );
}

/* ------------------------------ SkeletonText ------------------------------ */

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={i === lines - 1 ? 'w-3/4' : undefined}
        />
      ))}
    </div>
  );
}

/* ------------------------------ SkeletonCard ------------------------------ */

export interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-6 space-y-4',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-1/3" />
          <Skeleton variant="text" className="w-1/2" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}
