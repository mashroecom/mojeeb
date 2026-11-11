/**
 * Server-side data loading for the public landing page.
 *
 * The home page (a server component) loads everything here and hands it to the
 * client sections as props, so the server HTML already contains the CMS
 * content and the first client render uses exactly the same data.
 */

import type {
  LandingPageContent,
  PublicFaq,
  PublicPlan,
  PublicTestimonial,
} from '@/hooks/useLandingPage';

import { PUBLIC_CONTENT_TAG } from '@/lib/publicContent';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/** Same window as the locale layout's CMS fetch and the API's Cache-Control (5 min). */
const REVALIDATE_SECONDS = 300;

export interface LandingPageData {
  /** `null` when the API is unreachable — the sections then use their i18n defaults */
  cms: Partial<LandingPageContent> | null;
  testimonials: PublicTestimonial[];
  faqs: PublicFaq[];
  plans: PublicPlan[];
}

async function fetchPublic<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: [PUBLIC_CONTENT_TAG] },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}

function asArray<T>(value: T[] | null): T[] {
  return Array.isArray(value) ? value : [];
}

/** Just the landing-page CMS row (also carries the maintenance flag and texts). */
export async function getLandingCms(): Promise<Partial<LandingPageContent> | null> {
  const cms = await fetchPublic<Partial<LandingPageContent>>('/public/landing-page');
  return cms && typeof cms === 'object' ? cms : null;
}

export async function getLandingPageData(): Promise<LandingPageData> {
  const [cms, testimonials, faqs, plans] = await Promise.all([
    fetchPublic<Partial<LandingPageContent>>('/public/landing-page'),
    fetchPublic<PublicTestimonial[]>('/public/testimonials'),
    fetchPublic<PublicFaq[]>('/public/faq'),
    fetchPublic<PublicPlan[]>('/public/plans'),
  ]);

  return {
    cms: cms && typeof cms === 'object' ? cms : null,
    testimonials: asArray(testimonials),
    faqs: asArray(faqs),
    plans: asArray(plans),
  };
}
