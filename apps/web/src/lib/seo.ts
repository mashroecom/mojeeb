import type { Metadata } from 'next';

/** Public origin of the site, without a trailing slash. */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://mojeeb.app').replace(
  /\/+$/,
  '',
);

export const DEFAULT_OG_IMAGE = '/og-image.png';

export type SiteLocale = 'ar' | 'en';

/**
 * Path of a page in a given language. Arabic is the default locale and is
 * served without a prefix; English lives under /en.
 */
export function localePath(locale: string, path = ''): string {
  const clean = path === '/' ? '' : path;
  if (locale === 'en') return `/en${clean}`;
  return clean || '/';
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path === '/' ? '' : path}` || SITE_URL;
}

/** Canonical URL plus the hreflang pair for one page. */
export function alternatesFor(locale: string, path = ''): NonNullable<Metadata['alternates']> {
  return {
    canonical: localePath(locale, path),
    languages: {
      ar: localePath('ar', path),
      en: localePath('en', path),
      'x-default': localePath('ar', path),
    },
  };
}

export function siteNameFor(locale: string): string {
  return locale === 'ar' ? 'مجيب' : 'Mojeeb';
}

interface PageMetadataInput {
  locale: string;
  /** Path without the locale prefix, e.g. `/pricing` */
  path: string;
  title: string;
  description: string;
}

/**
 * Metadata for a public page: title, description, canonical, hreflang and the
 * social cards. (Next replaces `openGraph` wholesale in child segments, so the
 * full card is repeated here.)
 */
export function pageMetadata({ locale, path, title, description }: PageMetadataInput): Metadata {
  const siteName = siteNameFor(locale);
  const fullTitle = `${title} | ${siteName}`;
  return {
    title,
    description,
    alternates: alternatesFor(locale, path),
    openGraph: {
      type: 'website',
      locale: locale === 'ar' ? 'ar_EG' : 'en_US',
      alternateLocale: locale === 'ar' ? 'en_US' : 'ar_EG',
      url: localePath(locale, path),
      siteName,
      title: fullTitle,
      description,
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: siteName }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

/** For signed-in areas and utility pages that must stay out of search results. */
export const NO_INDEX: Metadata = {
  robots: { index: false, follow: false },
};

/** Public pages listed in the sitemap (paths without the locale prefix). */
export const PUBLIC_PAGES = [
  '',
  '/features',
  '/pricing',
  '/faq',
  '/about',
  '/contact',
  '/request-demo',
  '/careers',
  '/privacy',
  '/terms',
] as const;

/** Route prefixes (without locale) that are private or not worth indexing. */
export const PRIVATE_PREFIXES = [
  '/admin',
  '/dashboard',
  '/agents',
  '/analytics',
  '/api-keys',
  '/billing',
  '/conversations',
  '/customers',
  '/knowledge-base',
  '/leads',
  '/message-templates',
  '/settings',
  '/team',
  '/webhooks',
  '/onboarding',
  '/mobile',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/ui-demo',
  '/test-table-a11y',
] as const;
