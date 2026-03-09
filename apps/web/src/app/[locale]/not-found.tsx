'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('common');

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <p className="mt-4 text-xl text-muted-foreground">{t('pageNotFound')}</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t('goHome')}
        </Link>
      </div>
    </div>
  );
}
