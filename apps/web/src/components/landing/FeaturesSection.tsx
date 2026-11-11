'use client';

import { useTranslations, useLocale } from 'next-intl';
import { MessageSquare, Heart, GitBranch, UserCheck, BarChart3, Clock } from 'lucide-react';
import { parseLandingFeatures } from '@/hooks/useLandingPage';
import { ICON_MAP } from '@/components/admin/IconPicker';
import { localized, type LandingCms } from './cms';

const featureIcons: Record<string, typeof MessageSquare> = {
  ...ICON_MAP,
  // Legacy key aliases (used by default features)
  multichannel: MessageSquare,
  emotion: Heart,
  routing: GitBranch,
  leads: UserCheck,
  analytics: BarChart3,
  availability: Clock,
};

const DEFAULT_FEATURE_KEYS = [
  'multichannel',
  'emotion',
  'routing',
  'leads',
  'analytics',
  'availability',
] as const;

interface FeaturesSectionProps {
  /** Landing-page CMS content, loaded on the server by the page */
  cms: LandingCms;
}

export function FeaturesSection({ cms }: FeaturesSectionProps) {
  const t = useTranslations('landing.features');
  const locale = useLocale();
  const isAr = locale === 'ar';

  // Features are stored as a single bilingual array (each item has title + titleAr, etc.).
  // Items the admin added but left empty are skipped.
  const cmsFeatures = parseLandingFeatures(cms?.features)
    .filter((feature) => feature && typeof feature === 'object')
    .map((feature) => ({
      icon: feature.icon,
      title: localized(isAr, feature.title, feature.titleAr),
      description: localized(isAr, feature.description, feature.descriptionAr),
    }))
    .filter((feature) => feature.title || feature.description);

  // Nothing in the CMS yet → the six built-in features from the translations
  const features =
    cmsFeatures.length > 0
      ? cmsFeatures
      : DEFAULT_FEATURE_KEYS.map((key) => ({
          icon: key as string,
          title: t(`${key}.title`),
          description: t(`${key}.description`),
        }));

  const sectionTitle = localized(isAr, cms?.featuresTitle, cms?.featuresTitleAr, t('title'));
  const sectionSubtitle = localized(
    isAr,
    cms?.featuresSubtitle,
    cms?.featuresSubtitleAr,
    t('subtitle'),
  );

  return (
    <section id="features" className="py-20 bg-muted/30 scroll-mt-16">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold sm:text-4xl">{sectionTitle}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{sectionSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = featureIcons[feature.icon] || MessageSquare;
            return (
              <div
                key={i}
                className="group rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
