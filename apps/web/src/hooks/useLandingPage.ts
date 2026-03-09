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

export interface FooterLink {
  label: { en: string; ar: string };
  url: string;
}

export interface TrustedByLogo {
  image: string;
  name: string;
}

export interface LandingPageContent {
  // Hero
  heroEnabled: boolean;
  heroTitle: string;
  heroTitleAr: string;
  heroSubtitle: string;
  heroSubtitleAr: string;
  heroCta: string;
  heroCtaAr: string;
  heroCtaLink: string;
  heroImage: string | null;
  showNoCreditCard: boolean;
  badgeText: string;
  badgeTextAr: string;

  // Trusted By
  trustedByEnabled: boolean;
  trustedByTitle: string;
  trustedByTitleAr: string;
  trustedByLogos: TrustedByLogo[] | string;

  // Features
  featuresEnabled: boolean;
  featuresTitle: string;
  featuresTitleAr: string;
  featuresSubtitle: string;
  featuresSubtitleAr: string;
  features: LandingFeature[] | string;
  featuresAr: LandingFeature[] | string;

  // Stats
  statsEnabled: boolean;
  statsCustomers: string;
  statsMessages: string;
  statsLanguages: string;
  statsUptime: string;

  // Pricing
  pricingEnabled: boolean;
  pricingTitle: string;
  pricingTitleAr: string;
  pricingSubtitle: string;
  pricingSubtitleAr: string;
  showYearlyToggle: boolean;
  yearlyDiscount: number;
  enterpriseCtaText: string;
  enterpriseCtaTextAr: string;
  enterpriseCtaLink: string;

  // Testimonials
  testimonialsEnabled: boolean;
  testimonialsTitle: string;
  testimonialsTitleAr: string;
  testimonialsSubtitle: string;
  testimonialsSubtitleAr: string;
  testimonialsMaxDisplay: number;

  // FAQ
  faqEnabled: boolean;
  faqTitle: string;
  faqTitleAr: string;
  faqSubtitle: string;
  faqSubtitleAr: string;
  faqMaxDisplay: number;
  faqShowViewAll: boolean;

  // Bottom CTA
  bottomCtaEnabled: boolean;
  bottomCtaTitle: string;
  bottomCtaTitleAr: string;
  bottomCtaSubtitle: string;
  bottomCtaSubtitleAr: string;
  bottomCtaButtonText: string;
  bottomCtaButtonTextAr: string;
  bottomCtaButtonLink: string;

  // Footer
  footerCopyrightText: string;
  footerCopyrightTextAr: string;
  footerShowSocialLinks: boolean;
  footerTwitter: string;
  footerLinkedin: string;
  footerInstagram: string;
  footerFacebook: string;
  footerLinks: FooterLink[] | string;
  footerText: string;
  footerTextAr: string;
  customCss: string | null;

  // SEO
  seoMetaTitle: string;
  seoMetaTitleAr: string;
  seoMetaDescription: string;
  seoMetaDescriptionAr: string;
  seoOgImage: string | null;
  seoGoogleAnalyticsId: string;
  seoCustomHeadCode: string | null;
  seoCustomFooterCode: string | null;
  seoFavicon: string | null;

  // Maintenance
  maintenanceEnabled: boolean;
  maintenanceTitle: string;
  maintenanceTitleAr: string;
  maintenanceMessage: string;
  maintenanceMessageAr: string;

  // Section order
  sectionOrder: string[] | string;
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

/** Safely parse any JSON array field */
export function parseJsonArray<T>(val: T[] | string | undefined | null, fallback: T[] = []): T[] {
  if (!val) return fallback;
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
