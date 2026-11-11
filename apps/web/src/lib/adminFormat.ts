/**
 * Number formatting helpers for admin analytics pages.
 * All functions accept the locale string ('ar' | 'en') from next-intl's useLocale() and pass
 * it straight to Intl, matching how the admin dashboard formats numbers.
 */

const LTR_ISOLATE = '⁦';
const POP_ISOLATE = '⁩';

/**
 * In RTL text the bidi algorithm detaches "$" / "%" from the digits next to them
 * ("0.97$", "%45"). Wrapping the value in a left-to-right isolate keeps it intact.
 */
function isolate(text: string, locale: string): string {
  return locale === 'ar' ? `${LTR_ISOLATE}${text}${POP_ISOLATE}` : text;
}

/** Full integer / decimal — e.g. "582,367" */
export function fmtNumber(value: number, locale: string, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

/** Compact notation for chart axes — e.g. "582.4K" */
export function fmtCompact(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/** US dollars; sub-dollar amounts keep 4 decimals so small token costs stay visible */
export function fmtUsd(value: number, locale: string): string {
  const digits = value !== 0 && Math.abs(value) < 1 ? 4 : 2;
  const amount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return isolate(`$${amount}`, locale);
}

/** Percentage from a 0-100 value — e.g. 45.45 -> "45.5%" */
export function fmtPercent(value: number, locale: string, maximumFractionDigits = 1): string {
  const amount = new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
  return isolate(`${amount}%`, locale);
}
