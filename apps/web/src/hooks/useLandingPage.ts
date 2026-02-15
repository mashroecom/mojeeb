import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface LandingFeature {
  icon: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
}

export interface LandingPageContent {
  heroTitle: string;
  heroTitleAr: string;
  heroSubtitle: string;
  heroSubtitleAr: string;
  heroCta: string;
  heroCtaAr: string;
  heroCtaLink: string;
  featuresTitle: string;
  featuresTitleAr: string;
  features: LandingFeature[] | string;
  featuresAr: LandingFeature[] | string;
  statsEnabled: boolean;
  testimonialsEnabled: boolean;
  pricingTitle: string;
  pricingTitleAr: string;
  pricingSubtitle: string;
  pricingSubtitleAr: string;
  footerText: string;
  footerTextAr: string;
  customCss: string | null;
}

export function useLandingPageContent() {
  return useQuery({
    queryKey: ['public', 'landing-page'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/public/landing-page`);
      return data.data as LandingPageContent;
    },
    staleTime: 5 * 60 * 1000, // 5 min (matches server cache)
  });
}

/** Safely parse a JSON field that may be a string or already-parsed array */
export function parseLandingFeatures(raw: LandingFeature[] | string | undefined): LandingFeature[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
