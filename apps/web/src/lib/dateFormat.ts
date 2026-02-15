/**
 * Centralized date formatting utilities.
 * All functions accept a locale string ('ar' | 'en') from next-intl's useLocale().
 */

function resolveLocale(locale: string): string {
  return locale === 'ar' ? 'ar-EG' : 'en-US';
}

/** Format date only — e.g. "9 Feb 2026" / "٩ فبراير ٢٠٢٦" */
export function fmtDate(dateStr: string | null | undefined, locale: string): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString(resolveLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Format date + time — e.g. "9 Feb 2026, 2:30 PM" */
export function fmtDateTime(dateStr: string | null | undefined, locale: string): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleString(resolveLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format date with full month — e.g. "9 February 2026" / "٩ فبراير ٢٠٢٦" */
export function fmtDateLong(dateStr: string | null | undefined, locale: string): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString(resolveLocale(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Short date for chart labels — e.g. "Feb 9" / "٩ فبر" */
export function fmtDateShort(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(resolveLocale(locale), {
    month: 'short',
    day: 'numeric',
  });
}

/** Format time only — e.g. "2:30 PM" */
export function fmtTime(dateStr: string | number, locale: string): string {
  return new Date(dateStr).toLocaleTimeString(resolveLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
  });
}
