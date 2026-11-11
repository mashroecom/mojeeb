'use client';
import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminChartCardProps {
  title: string;
  icon?: LucideIcon;
  iconColor?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Card wrapper for the Mojeeb*Chart components.
 *
 * The title follows the page direction, while the chart itself is kept LTR: Recharts positions
 * SVG axis ticks, labels and legends assuming LTR, so they overlap the plot in RTL locales.
 * The chart's own border/padding is removed so it sits flush inside this card.
 */
export function AdminChartCard({
  title,
  icon: Icon,
  iconColor = 'text-muted-foreground',
  children,
  className,
}: AdminChartCardProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-6 shadow-sm', className)}>
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className={cn('h-5 w-5', iconColor)} />}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div dir="ltr" className="[&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0">
        {children}
      </div>
    </div>
  );
}
