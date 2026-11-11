'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, ArrowRight, Phone, Sparkles } from 'lucide-react';
import { CmsLink } from './CmsLink';
import { localized, resolveCmsImageUrl, type LandingCms } from './cms';
import { LogoMark } from '@/components/brand/Logo';

interface HeroSectionProps {
  /** Landing-page CMS content, loaded on the server by the page */
  cms: LandingCms;
}

/** Column defaults of the landing-page CMS row: placeholders, not copy an admin wrote. */
const STOCK_HERO_TEXT = new Set([
  'AI-Powered Customer Support',
  'دعم العملاء بالذكاء الاصطناعي',
  'Automate your customer support with intelligent AI agents',
  'أتمت دعم العملاء مع وكلاء ذكاء اصطناعي',
  'Powered by AI',
  'مدعوم بالذكاء الاصطناعي',
]);

function custom(value: unknown): unknown {
  return typeof value === 'string' && STOCK_HERO_TEXT.has(value.trim()) ? undefined : value;
}

export function HeroSection({ cms }: HeroSectionProps) {
  const t = useTranslations('landing.hero');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  // CMS text (Arabic → English → translation default)
  // (the CMS row's stock placeholders count as "not set", so the real copy shows)
  const title = localized(isAr, custom(cms?.heroTitle), custom(cms?.heroTitleAr), t('title'));
  const subtitle = localized(
    isAr,
    custom(cms?.heroSubtitle),
    custom(cms?.heroSubtitleAr),
    t('subtitle'),
  );
  const ctaText = localized(isAr, cms?.heroCta, cms?.heroCtaAr, t('cta'));
  const badgeText = localized(isAr, custom(cms?.badgeText), custom(cms?.badgeTextAr), t('badge'));
  const showNoCreditCard = cms?.showNoCreditCard !== false;
  const heroImage = resolveCmsImageUrl(cms?.heroImage);

  return (
    <section id="hero" className="relative overflow-hidden py-20 sm:py-32">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-secondary via-background to-background" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[520px] opacity-60 [background-image:radial-gradient(hsl(var(--primary)/0.14)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />

      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background px-4 py-1.5 text-sm font-medium text-foreground shadow-sm">
            <Sparkles className="h-4 w-4 text-highlight" />
            <span>{badgeText}</span>
          </div>

          {/* Title */}
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl sm:leading-tight lg:text-6xl lg:leading-[1.15]">
            {title}
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl leading-relaxed">
            {subtitle}
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <CmsLink
              href={cms?.heroCtaLink}
              fallbackHref="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {ctaText}
              <Arrow className="h-4 w-4" />
            </CmsLink>
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
            <p className="mt-4 text-xs text-muted-foreground">{t('noCreditCard')}</p>
          )}

          {/* Hero image or chat demo preview */}
          {heroImage ? (
            <div className="mt-16 rounded-xl border bg-card p-2 sm:p-4 shadow-2xl">
              <img src={heroImage} alt="" className="rounded-lg w-full object-cover" />
            </div>
          ) : (
            <div className="mt-16 rounded-xl border bg-card p-2 sm:p-4 shadow-2xl">
              <div className="rounded-lg bg-muted/50 p-3 sm:p-6">
                <div className="mb-4 flex items-center gap-3 border-b pb-3 text-start">
                  <LogoMark className="h-9 w-9" />
                  <div>
                    <p className="text-sm font-semibold">{isAr ? 'مجيب' : 'Mojeeb'}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {isAr ? 'متصل الآن' : 'Online now'}
                    </p>
                  </div>
                </div>
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
                        <div
                          className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
                          style={{ animationDelay: '0ms' }}
                        />
                        <div
                          className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <div
                          className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
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
