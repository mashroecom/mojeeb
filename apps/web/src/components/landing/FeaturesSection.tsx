'use client';

import { useTranslations, useLocale } from 'next-intl';
import { MessageSquare, Heart, GitBranch, UserCheck, BarChart3, Clock } from 'lucide-react';
import { useLandingPageContent, parseLandingFeatures, type LandingFeature } from '@/hooks/useLandingPage';
import { ICON_MAP } from '@/components/admin/IconPicker';

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

const DEFAULT_FEATURE_KEYS = ['multichannel', 'emotion', 'routing', 'leads', 'analytics', 'availability'] as const;

export function FeaturesSection() {
  const t = useTranslations('landing.features');
  const locale = useLocale();
  const isAr = locale === 'ar';

  const { data: cms } = useLandingPageContent();

  const cmsFeatures = parseLandingFeatures(isAr ? cms?.featuresAr : cms?.features);
  const hasCmsFeatures = cmsFeatures.length > 0;

  // CMS override for title, fallback to translation
  const sectionTitle = (isAr ? cms?.featuresTitleAr : cms?.featuresTitle) || t('title');

  return (
    <section id="features" className="py-20 bg-muted/30 scroll-mt-16">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold sm:text-4xl">{sectionTitle}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {hasCmsFeatures
            ? cmsFeatures.map((feature, i) => {
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
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                );
              })
            : DEFAULT_FEATURE_KEYS.map((key) => {
                const Icon = featureIcons[key];
                return (
                  <div
                    key={key}
                    className="group rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
                  >
                    <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{t(`${key}.title`)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(`${key}.description`)}</p>
                  </div>
                );
              })}
        </div>
      </div>
    </section>
  );
}
