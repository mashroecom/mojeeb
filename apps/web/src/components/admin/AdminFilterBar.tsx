'use client';
import { useTranslations } from 'next-intl';
import { Filter } from 'lucide-react';
import { type ReactNode } from 'react';

interface AdminFilterBarProps {
  children: ReactNode;
}

export function AdminFilterBar({ children }: AdminFilterBarProps) {
  const t = useTranslations('admin.common');
  return (
    <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
        <Filter className="h-4 w-4" />
        {t('filters')}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
    </div>
  );
}
