'use client';

import { useTranslations } from 'next-intl';
import { useLandingPageContent } from '@/hooks/useLandingPage';
import {
  Building2,
  Users,
  MessageSquare,
  Globe,
  Clock,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Heart,
} from 'lucide-react';

const valueIcons = {
  innovation: Lightbulb,
  privacy: ShieldCheck,
  simplicity: Sparkles,
  support: Heart,
};

export default function AboutPage() {
  const t = useTranslations('about');
  const { data: cms } = useLandingPageContent();

  return (
    <div>
      {/* Hero Section */}
      <section className="py-20 sm:py-28">
        <div className="container max-w-4xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {t('subtitle')}
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="border-t bg-muted/30 py-16 sm:py-24">
        <div className="container max-w-5xl">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-8 sm:p-10">
              <h2 className="mb-4 text-2xl font-bold">{t('mission.title')}</h2>
              <p className="leading-relaxed text-muted-foreground">
                {t('mission.content')}
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-8 sm:p-10">
              <h2 className="mb-4 text-2xl font-bold">{t('vision.title')}</h2>
              <p className="leading-relaxed text-muted-foreground">
                {t('vision.content')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 sm:py-24">
        <div className="container max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {[
              { value: cms?.statsCustomers || '500+', label: t('stats.customers'), icon: Users },
              { value: cms?.statsMessages || '10M+', label: t('stats.messages'), icon: MessageSquare },
              { value: cms?.statsLanguages || '20+', label: t('stats.languages'), icon: Globe },
              { value: cms?.statsUptime || '99.9%', label: t('stats.uptime'), icon: Clock },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center rounded-2xl border bg-card p-6 text-center sm:p-8"
              >
                <stat.icon className="mb-3 h-6 w-6 text-primary" />
                <span className="text-3xl font-bold sm:text-4xl">{stat.value}</span>
                <span className="mt-2 text-sm text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-t bg-muted/30 py-16 sm:py-24">
        <div className="container max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold sm:text-4xl">
            {t('values.title')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {(
              ['innovation', 'privacy', 'simplicity', 'support'] as const
            ).map((value) => {
              const Icon = valueIcons[value];
              return (
                <div
                  key={value}
                  className="flex gap-4 rounded-2xl border bg-card p-6 sm:p-8"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-lg font-semibold">
                      {t(`values.${value}.title`)}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t(`values.${value}.description`)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
