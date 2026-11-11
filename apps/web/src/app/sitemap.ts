import type { MetadataRoute } from 'next';
import { PUBLIC_PAGES, absoluteUrl, localePath } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const page of PUBLIC_PAGES) {
    const languages = {
      ar: absoluteUrl(localePath('ar', page)),
      en: absoluteUrl(localePath('en', page)),
    };
    for (const locale of ['ar', 'en'] as const) {
      entries.push({
        url: languages[locale],
        lastModified: now,
        changeFrequency: page === '' ? 'weekly' : 'monthly',
        priority: page === '' ? 1.0 : page === '/pricing' || page === '/features' ? 0.9 : 0.6,
        alternates: { languages },
      });
    }
  }

  return entries;
}
