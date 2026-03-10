import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://mojeeb.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ['en', 'ar'];
  const pages = [
    '',
    '/features',
    '/pricing',
    '/about',
    '/contact',
    '/request-demo',
    '/careers',
    '/privacy',
    '/terms',
  ];
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const page of pages) {
      entries.push({
        url: `${SITE_URL}/${locale}${page}`,
        lastModified: now,
        changeFrequency: page === '' ? 'weekly' : 'monthly',
        priority: page === '' ? 1.0 : 0.7,
      });
    }
  }

  return entries;
}
