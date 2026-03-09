'use client';

import React from 'react';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type KBDocument } from '@/hooks/useKnowledgeBase';

interface StatusBadgeProps {
  status: KBDocument['embeddingStatus'];
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const colorMap: Record<KBDocument['embeddingStatus'], string> = {
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    PROCESSING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  const iconMap: Record<KBDocument['embeddingStatus'], React.ReactNode> = {
    PENDING: <Clock className="h-3 w-3" />,
    PROCESSING: <Loader2 className="h-3 w-3 animate-spin" />,
    COMPLETED: <CheckCircle className="h-3 w-3" />,
    FAILED: <XCircle className="h-3 w-3" />,
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorMap[status],
      )}
    >
      {iconMap[status]}
      {label}
    </span>
  );
}
