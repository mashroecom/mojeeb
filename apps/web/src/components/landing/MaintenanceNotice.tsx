'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Wrench } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { localized, type LandingCms } from './cms';

interface MaintenanceNoticeProps {
  /** Landing-page CMS content (in maintenance mode: only the `maintenance*` fields) */
  cms: LandingCms;
}

/**
 * Full-page notice shown instead of the landing page while maintenance mode
 * is on. The sign-in link stays available because the dashboard and the admin
 * panel keep working during maintenance.
 */
export function MaintenanceNotice({ cms }: MaintenanceNoticeProps) {
  const t = useTranslations('landing.maintenance');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const isAr = locale === 'ar';

  const title = localized(isAr, cms?.maintenanceTitle, cms?.maintenanceTitleAr, t('title'));
  const message = localized(isAr, cms?.maintenanceMessage, cms?.maintenanceMessageAr, t('message'));

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />

      <div className="absolute end-6 top-6">
        <LanguageSwitcher />
      </div>

      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Wrench className="h-8 w-8" aria-hidden="true" />
        </div>
        {/* dir="auto": the text may be in the other language (single-language Site Settings message) */}
        <h1 dir="auto" className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p
          dir="auto"
          className="mt-4 whitespace-pre-line text-lg leading-relaxed text-muted-foreground"
        >
          {message}
        </p>
        <Link
          href="/login"
          className="mt-10 inline-flex items-center rounded-lg border px-6 py-3 text-sm font-medium hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {tNav('login')}
        </Link>
      </div>
    </main>
  );
}
