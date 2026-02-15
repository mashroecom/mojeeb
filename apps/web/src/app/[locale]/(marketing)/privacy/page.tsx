'use client';

import { useTranslations } from 'next-intl';
import { Shield } from 'lucide-react';

export default function PrivacyPage() {
  const t = useTranslations('privacy');

  const sections = [
    'intro',
    'dataCollection',
    'dataUsage',
    'dataSecurity',
    'cookies',
    'thirdParty',
    'userRights',
    'changes',
    'contact',
  ] as const;

  const sectionsWithItems = ['dataCollection', 'dataUsage', 'userRights'];

  return (
    <div className="py-16 sm:py-24">
      <div className="container max-w-4xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-4 text-muted-foreground">{t('lastUpdated')}</p>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section} className="rounded-xl border bg-card p-6 sm:p-8">
              <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
                {t(`${section}.title`)}
              </h2>
              <p className="leading-relaxed text-muted-foreground">
                {t(`${section}.content`)}
              </p>
              {sectionsWithItems.includes(section) && (
                <ul className="mt-4 list-disc space-y-2 ps-6 text-muted-foreground">
                  {(t.raw(`${section}.items`) as string[]).map((item, index) => (
                    <li key={index} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
