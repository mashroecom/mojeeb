'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Bot, MessageCircle, Zap, Shield, BarChart3, Globe } from 'lucide-react';

export function LandingContent() {
  const t = useTranslations('landing');

  const heroTitle = t('hero.title');
  const heroSubtitle = t('hero.subtitle');

  return (
    <div>
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            {heroTitle}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl max-w-2xl mx-auto">
            {heroSubtitle}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t('hero.cta')}
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border px-6 py-3 text-base font-medium hover:bg-muted transition-colors"
            >
              {t('hero.login')}
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold sm:text-4xl">{t('features.title')}</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t('features.subtitle')}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Bot className="h-6 w-6" />}
              title={t('features.ai.title')}
              description={t('features.ai.description')}
            />
            <FeatureCard
              icon={<MessageCircle className="h-6 w-6" />}
              title={t('features.channels.title')}
              description={t('features.channels.description')}
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title={t('features.automation.title')}
              description={t('features.automation.description')}
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title={t('features.security.title')}
              description={t('features.security.description')}
            />
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              title={t('features.analytics.title')}
              description={t('features.analytics.description')}
            />
            <FeatureCard
              icon={<Globe className="h-6 w-6" />}
              title={t('features.multilingual.title')}
              description={t('features.multilingual.description')}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">{t('cta.title')}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t('cta.subtitle')}</p>
          <div className="mt-8">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t('cta.button')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
