'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { type KBDocument } from '@/hooks/useKnowledgeBase';

interface ContentTypeBadgeProps {
  type: KBDocument['contentType'];
  label: string;
}

export function ContentTypeBadge({ type, label }: ContentTypeBadgeProps) {
  const colorMap: Record<string, string> = {
    TEXT: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    FAQ: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    PDF: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    URL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorMap[type] || colorMap.TEXT,
      )}
    >
      {label}
    </span>
  );
}
