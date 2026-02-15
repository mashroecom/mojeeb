'use client';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

interface AdminEmptyStateProps {
  icon: LucideIcon;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function AdminEmptyState({ icon: Icon, message, action, className }: AdminEmptyStateProps) {
  return (
    <div className={cn('py-16 text-center', className)}>
      <Icon className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      {action}
    </div>
  );
}
