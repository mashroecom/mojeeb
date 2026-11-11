'use client';

import { useMemo, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/ui/ErrorState';

/**
 * Small building blocks shared by the admin analytics pages (AI models, message
 * analytics, sentiment analysis, conversation quality, security audit).
 */

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const PROVIDER_NAMES: Record<string, string> = {
  OPENAI: 'OpenAI',
  ANTHROPIC: 'Anthropic',
};

/** Brand name for an AI provider enum value; `unknownLabel` for the API's "unknown". */
export function providerLabel(provider: string | null | undefined, unknownLabel: string): string {
  if (!provider || provider === 'unknown') return unknownLabel;
  return PROVIDER_NAMES[provider] ?? provider;
}

/** Locale-aware number/percent/day formatters for the current UI locale. */
export function useAnalyticsFormat() {
  const locale = useLocale();
  return useMemo(() => {
    const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-US';
    const number = new Intl.NumberFormat(locale);
    const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
    return {
      locale,
      /** 12,345 */
      num: (n: number | null | undefined) => number.format(n ?? 0),
      /** 4.2 */
      dec: (n: number | null | undefined) => decimal.format(n ?? 0),
      /** Takes a 0–100 value: 42.5 -> "42.5%" */
      pct: (n: number | null | undefined) => percent.format((n ?? 0) / 100),
      /**
       * Chart label for a SQL DATE() bucket. Buckets are calendar days, so they are
       * formatted in UTC to avoid shifting a day in the viewer's timezone.
       */
      day: (date: string) =>
        new Date(date).toLocaleDateString(dateLocale, {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }),
    };
  }, [locale]);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Heading for a block that brings its own card (tables, charts). */
export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Titled wrapper for a recharts chart. Recharts lays out axes and tick labels assuming
 * LTR and mis-anchors them inside an RTL container, so the chart itself is always
 * rendered LTR while the title follows the page direction.
 */
export function ChartBlock({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <SectionTitle title={title} hint={hint} />
      <div dir="ltr">{children}</div>
    </div>
  );
}

export function RefreshButton({
  label,
  onClick,
  isFetching,
}: {
  label: string;
  onClick: () => void;
  isFetching?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isFetching}
      className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
    >
      <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/** Full-width error card with a retry action. */
export function AnalyticsError({
  title,
  retryLabel,
  onRetry,
  className,
}: {
  title: string;
  retryLabel: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border bg-card shadow-sm', className)}>
      <ErrorState title={title} retryLabel={retryLabel} onRetry={onRetry} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar list (label + proportional bar + value)
// ---------------------------------------------------------------------------

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  /** Tailwind background class for the bar and the legend dot. */
  color: string;
}

export function BarList({
  items,
  total,
  formatValue,
  formatPercent,
}: {
  items: BarListItem[];
  /** Denominator for the percentages; defaults to the sum of the items. */
  total?: number;
  formatValue: (n: number) => string;
  formatPercent: (n: number) => string;
}) {
  const sum = total ?? items.reduce((s, i) => s + i.value, 0);
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const pct = sum > 0 ? (item.value / sum) * 100 : 0;
        return (
          <li key={item.key}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', item.color)} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground">{formatValue(item.value)}</span>
                <span className="mx-1.5">·</span>
                {formatPercent(pct)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all', item.color)}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
