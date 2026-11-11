'use client';

import { Fragment, type ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { HeroSection } from './HeroSection';
import { TrustedBySection } from './TrustedBySection';
import { FeaturesSection } from './FeaturesSection';
import { StatsSection } from './StatsSection';
import { PricingSection } from './PricingSection';
import { TestimonialsSection } from './TestimonialsSection';
import { FAQSection } from './FAQSection';
import { CTASection } from './CTASection';
import {
  isSectionEnabled,
  localized,
  positiveInt,
  resolveSectionOrder,
  type LandingSectionId,
} from './cms';
import type { LandingPageData } from './landingData';

/**
 * The public landing page, driven by the admin CMS (Admin → Landing Page).
 *
 * All data is loaded on the server by the page and arrives as props; nothing
 * here fetches on its own, so the server HTML and the first client render are
 * built from the same data. Each section honours its `*Enabled` toggle and the
 * admin-defined section order. Every text falls back Arabic → English → i18n
 * default, so the page is complete even with an empty or unreachable CMS.
 */
export function LandingContent({ cms, testimonials, faqs, plans }: LandingPageData) {
  const t = useTranslations('landing');
  const locale = useLocale();
  const isAr = locale === 'ar';

  const renderSection: Record<LandingSectionId, () => ReactNode> = {
    hero: () => <HeroSection cms={cms} />,

    trustedBy: () => (
      <TrustedBySection
        title={localized(isAr, cms?.trustedByTitle, cms?.trustedByTitleAr, t('trustedBy.title'))}
        logos={cms?.trustedByLogos}
      />
    ),

    features: () => <FeaturesSection cms={cms} />,

    stats: () => <StatsSection cms={cms} />,

    pricing: () => (
      <PricingSection
        initialPlans={plans}
        title={localized(isAr, cms?.pricingTitle, cms?.pricingTitleAr, t('pricing.title'))}
        subtitle={localized(
          isAr,
          cms?.pricingSubtitle,
          cms?.pricingSubtitleAr,
          t('pricing.subtitle'),
        )}
        showYearlyToggle={cms?.showYearlyToggle !== false}
        yearlyDiscount={typeof cms?.yearlyDiscount === 'number' ? cms.yearlyDiscount : undefined}
        enterpriseCtaText={
          localized(isAr, cms?.enterpriseCtaText, cms?.enterpriseCtaTextAr) || undefined
        }
        enterpriseCtaLink={cms?.enterpriseCtaLink || undefined}
      />
    ),

    testimonials: () => (
      <TestimonialsSection
        testimonials={testimonials}
        maxDisplay={positiveInt(cms?.testimonialsMaxDisplay, 3)}
        title={localized(
          isAr,
          cms?.testimonialsTitle,
          cms?.testimonialsTitleAr,
          t('testimonials.title'),
        )}
        subtitle={localized(
          isAr,
          cms?.testimonialsSubtitle,
          cms?.testimonialsSubtitleAr,
          t('testimonials.subtitle'),
        )}
      />
    ),

    faq: () => (
      <FAQSection
        faqs={faqs}
        maxDisplay={positiveInt(cms?.faqMaxDisplay, 5)}
        showViewAll={cms?.faqShowViewAll !== false}
        title={localized(isAr, cms?.faqTitle, cms?.faqTitleAr, t('faq.title'))}
        subtitle={localized(isAr, cms?.faqSubtitle, cms?.faqSubtitleAr, t('faq.subtitle'))}
      />
    ),

    bottomCta: () => (
      <CTASection
        title={localized(isAr, cms?.bottomCtaTitle, cms?.bottomCtaTitleAr) || undefined}
        subtitle={localized(isAr, cms?.bottomCtaSubtitle, cms?.bottomCtaSubtitleAr) || undefined}
        buttonText={
          localized(isAr, cms?.bottomCtaButtonText, cms?.bottomCtaButtonTextAr) || undefined
        }
        buttonLink={cms?.bottomCtaButtonLink || undefined}
      />
    ),
  };

  return (
    <>
      {resolveSectionOrder(cms?.sectionOrder)
        .filter((id) => isSectionEnabled(cms, id))
        .map((id) => (
          <Fragment key={id}>{renderSection[id]()}</Fragment>
        ))}
    </>
  );
}
