import type { MetadataRoute } from 'next';
import { PRIVATE_PREFIXES, SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  // Arabic is served without a prefix, English under /en.
  const disallow = ['/api/', '/web-api/'];
  for (const prefix of PRIVATE_PREFIXES) {
    disallow.push(prefix, `/en${prefix}`);
  }

  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
