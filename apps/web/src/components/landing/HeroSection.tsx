'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, ArrowRight, Phone, Sparkles } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useLandingPageContent } from '@/hooks/useLandingPage';

export function HeroSection() {
  const t = useTranslations('landing.hero');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  const { data: cms } = useLandingPageContent();

  // CMS overrides with translation fallbacks
  const title = (isAr ? cms?.heroTitleAr : cms?.heroTitle) || t('title');
  const subtitle = (isAr ? cms?.heroSubtitleAr : cms?.heroSubtitle) || t('subtitle');
  const ctaText = (isAr ? cms?.heroCtaAr : cms?.heroCta) || t('cta');
  const ctaLink = cms?.heroCtaLink || '/register';
  const badgeText = (isAr ? cms?.badgeTextAr : cms?.badgeText) || t('badge');
  const showNoCreditCard = cms?.showNoCreditCard !== false;

  return (
    <section className="relative overflow-hidden py-20 sm:py-32">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />

      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>{badgeText}</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {title}
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl leading-relaxed">
            {subtitle}
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={ctaLink}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {ctaText}
              <Arrow className="h-4 w-4" />
            </Link>
            <Link
              href="/request-demo"
              className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Phone className="h-4 w-4" />
              {t('ctaSecondary')}
            </Link>
          </div>

          {/* No credit card badge */}
          {showNoCreditCard && (
            <p className="mt-4 text-xs text-muted-foreground">
              {t('noCreditCard')}
            </p>
          )}

          {/* Hero image or chat demo preview */}
          {cms?.heroImage ? (
            <div className="mt-16 rounded-xl border bg-card p-2 sm:p-4 shadow-2xl">
              <img
                src={cms.heroImage.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${cms.heroImage}` : cms.heroImage}
                alt="Hero"
                className="rounded-lg w-full object-cover"
              />
            </div>
          ) : (
            <div className="mt-16 rounded-xl border bg-card p-2 sm:p-4 shadow-2xl">
              <div className="rounded-lg bg-muted/50 p-3 sm:p-6">
                <div className="space-y-4">
                  {/* Customer message */}
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-ss-none bg-muted px-4 py-2 max-w-xs">
                      <p className="text-sm">{t('demoChatMessage')}</p>
                    </div>
                  </div>
                  {/* AI response */}
                  <div className="flex justify-end">
                    <div className="rounded-2xl rounded-se-none bg-primary px-4 py-2 max-w-sm text-primary-foreground">
                      <p className="text-sm">{t('demoChatAIResponse')}</p>
                    </div>
                  </div>
                  {/* Typing indicator */}
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-ss-none bg-muted px-4 py-3">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
