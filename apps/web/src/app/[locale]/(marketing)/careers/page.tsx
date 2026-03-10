'use client';

import { useTranslations } from 'next-intl';
import { Briefcase, Globe, GraduationCap, Rocket, Users, Mail } from 'lucide-react';

const benefitIcons = {
  remote: Globe,
  growth: GraduationCap,
  impact: Rocket,
  culture: Users,
};

export default function CareersPage() {
  const t = useTranslations('careers');

  return (
    <div>
      {/* Hero Section */}
      <section className="py-20 sm:py-28">
        <div className="container max-w-4xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Briefcase className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {t('subtitle')}
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t bg-muted/30 py-16 sm:py-24">
        <div className="container max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold sm:text-4xl">
            {t('benefits.title')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {(['remote', 'growth', 'impact', 'culture'] as const).map((benefit) => {
              const Icon = benefitIcons[benefit];
              return (
                <div key={benefit} className="flex gap-4 rounded-2xl border bg-card p-6 sm:p-8">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-lg font-semibold">{t(`benefits.${benefit}.title`)}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t(`benefits.${benefit}.description`)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-16 sm:py-24">
        <div className="container max-w-3xl">
          <h2 className="mb-8 text-center text-3xl font-bold sm:text-4xl">
            {t('positions.title')}
          </h2>
          <div className="rounded-2xl border bg-card p-8 text-center sm:p-12">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="mb-6 text-lg text-muted-foreground">{t('positions.empty')}</p>
            <div className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-5 py-3 text-sm font-medium text-primary">
              <Mail className="h-4 w-4" />
              {t('positions.contact')}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
