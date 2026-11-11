/**
 * Helpers shared by the public landing-page sections.
 *
 * Everything here is pure and has no React / browser dependency, so the same
 * code runs during SSR and in the browser and always yields the same result
 * for the same CMS payload (no hydration drift).
 */

import type { LandingPageContent } from '@/hooks/useLandingPage';

/**
 * CMS payload as the public sections see it: `null` when the API could not be
 * reached, and partial because the endpoint strips most fields in maintenance
 * mode.
 */
export type LandingCms = Partial<LandingPageContent> | null | undefined;

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/** Section ids, in the default order — must match the admin CMS (Section Order tab). */
export const DEFAULT_SECTION_ORDER = [
  'hero',
  'trustedBy',
  'features',
  'stats',
  'pricing',
  'testimonials',
  'faq',
  'bottomCta',
] as const;

export type LandingSectionId = (typeof DEFAULT_SECTION_ORDER)[number];

/** `*Enabled` defaults used when the CMS does not say (same as the DB defaults). */
const SECTION_ENABLED_DEFAULT: Record<LandingSectionId, boolean> = {
  hero: true,
  trustedBy: false,
  features: true,
  stats: false,
  pricing: true,
  testimonials: true,
  faq: true,
  bottomCta: true,
};

function isSectionId(value: unknown): value is LandingSectionId {
  return typeof value === 'string' && (DEFAULT_SECTION_ORDER as readonly string[]).includes(value);
}

/**
 * Admin-defined section order. `sectionOrder` is a JSON column, so it may
 * arrive as an array or as a JSON string. Unknown ids and duplicates are
 * dropped, and sections missing from the saved order are appended in their
 * default position order (the admin page does the same when it loads).
 */
export function resolveSectionOrder(raw: unknown): LandingSectionId[] {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      list = null;
    }
  }

  const order: LandingSectionId[] = [];
  if (Array.isArray(list)) {
    for (const id of list) {
      if (isSectionId(id) && !order.includes(id)) order.push(id);
    }
  }
  for (const id of DEFAULT_SECTION_ORDER) {
    if (!order.includes(id)) order.push(id);
  }
  return order;
}

export function isSectionEnabled(cms: LandingCms, id: LandingSectionId): boolean {
  const value = cms?.[`${id}Enabled`];
  return typeof value === 'boolean' ? value : SECTION_ENABLED_DEFAULT[id];
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Pick a CMS text for the current locale.
 * Arabic: Arabic value → English value → fallback. English: English value → fallback.
 */
export function localized(isAr: boolean, en: unknown, ar: unknown, fallback = ''): string {
  return (isAr ? text(ar) || text(en) : text(en)) || fallback;
}

/** A positive whole number from the CMS, or `fallback` when it is missing / invalid. */
export function positiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? Math.floor(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ---------------------------------------------------------------------------
// URLs (admin-entered, so never trusted as-is)
// ---------------------------------------------------------------------------

/** Origin of the API server, which also serves `/uploads/*`. */
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(
  /\/api\/v1\/?$/,
  '',
);

const HTTP_URL = /^https?:\/\/[^\s/]/i;

/** Site-relative path: one leading slash, not protocol-relative (`//host`) and no backslash tricks. */
function isSitePath(value: string): boolean {
  return value.startsWith('/') && !/^\/[/\\]/.test(value) && !/[\s\\]/.test(value);
}

/**
 * Resolve an admin-entered image URL to something safe to put in `<img src>`.
 * Only absolute http(s) URLs and site-relative paths are accepted; anything
 * else (`javascript:`, `data:`, `//host`, bare file names…) yields `null`.
 * Upload paths (`/uploads/...`) are served by the API, so they are resolved
 * against the API origin; other site-relative paths belong to this site.
 */
export function resolveCmsImageUrl(raw: unknown): string | null {
  const value = text(raw);
  if (!value) return null;
  if (HTTP_URL.test(value)) return value;
  if (!isSitePath(value)) return null;
  // Files served by the API: landing uploads (/uploads/...) and branding assets
  // stored through Site Settings (/api/v1/files/...)
  return value.startsWith('/uploads/') || value.startsWith('/api/')
    ? `${API_ORIGIN}${value}`
    : value;
}

export type CmsLinkTarget =
  | { kind: 'internal'; href: string }
  | { kind: 'external'; href: string }
  | { kind: 'anchor'; href: string };

/**
 * Classify an admin-entered link. Returns `null` for anything that is not an
 * http(s) URL, a site-relative path or an in-page anchor.
 */
export function resolveCmsLink(raw: unknown): CmsLinkTarget | null {
  const value = text(raw);
  if (!value) return null;
  if (HTTP_URL.test(value)) return { kind: 'external', href: value };
  if (/^#[\w-]+$/.test(value)) return { kind: 'anchor', href: value };
  if (!isSitePath(value)) return null;
  // The locale prefix is added by the i18n <Link>; drop one typed by the admin.
  const href = value.replace(/^\/(?:en|ar)(?=[/?#]|$)/, '');
  return { kind: 'internal', href: href.startsWith('/') ? href : `/${href}` };
}
