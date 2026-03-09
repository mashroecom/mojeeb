'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, ArrowRight, Phone } from 'lucide-react';
import { useLocale } from 'next-intl';

interface CTASectionProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonLink?: string;
}

export function CTASection({ title, subtitle, buttonText, buttonLink }: CTASectionProps) {
  const t = useTranslations('landing.cta');
  const locale = useLocale();
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <section id="contact" className="py-20 bg-primary/5 scroll-mt-16">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">{title || t('title')}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{subtitle || t('subtitle')}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={buttonLink || '/register'}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {buttonText || t('button')}
              <Arrow className="h-4 w-4" />
            </Link>
            <Link
              href="/request-demo"
              className="inline-flex items-center gap-2 rounded-lg border px-8 py-3.5 text-sm font-medium hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Phone className="h-4 w-4" />
              {t('demoButton')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
