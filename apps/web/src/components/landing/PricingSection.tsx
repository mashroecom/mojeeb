'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface PlanData {
  plan: string;
  displayName: string;
  displayNameAr: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  messagesPerMonth: number;
  maxAgents: number;
  maxChannels: number;
  maxKnowledgeBases: number;
  maxTeamMembers: number;
  apiAccess: boolean;
  isPopular: boolean;
  features: string;
  featuresAr: string;
}

interface PricingSectionProps {
  title?: string;
  subtitle?: string;
  showYearlyToggle?: boolean;
  yearlyDiscount?: number;
  enterpriseCtaText?: string;
  enterpriseCtaLink?: string;
}

export function PricingSection({
  title,
  subtitle,
  showYearlyToggle,
  yearlyDiscount = 20,
  enterpriseCtaText,
  enterpriseCtaLink,
}: PricingSectionProps) {
  const t = useTranslations('landing.pricing');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  const [isYearly, setIsYearly] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['public', 'plans'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/public/plans`);
      return data.data as PlanData[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Show skeleton while loading — NO hardcoded fallback
  if (isLoading) {
    return (
      <section id="pricing" className="py-20 scroll-mt-16">
        <div className="container">
          <div className="text-center mb-12">
            <div className="mx-auto h-9 w-64 animate-pulse rounded bg-muted" />
            <div className="mx-auto mt-4 h-5 w-80 animate-pulse rounded bg-muted" />
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border p-8 animate-pulse">
                <div className="h-6 bg-muted rounded w-24 mb-4" />
                <div className="h-10 bg-muted rounded w-32 mb-6" />
                <div className="space-y-3 mb-8">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <div key={j} className="h-4 bg-muted rounded w-full" />
                  ))}
                </div>
                <div className="h-10 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Don't render if no plans in database
  if (!plans || plans.length === 0) return null;

  return (
    <section id="pricing" className="py-20 scroll-mt-16">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold sm:text-4xl">{title || t('title')}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{subtitle || t('subtitle')}</p>

          {/* Yearly / Monthly toggle */}
          {showYearlyToggle && (
            <div className="mt-8 inline-flex items-center gap-3 rounded-full border bg-muted/50 p-1">
              <button
                onClick={() => setIsYearly(false)}
                className={cn(
                  'rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  !isYearly ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t('monthly')}
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={cn(
                  'rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isYearly ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t('yearly')}
                {yearlyDiscount > 0 && (
                  <span className="ms-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    -{yearlyDiscount}%
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        <div className={cn(
          'mx-auto grid max-w-5xl grid-cols-1 gap-8',
          plans.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4',
        )}>
          {plans.map((plan) => {
            const features = parseFeatures(isAr ? plan.featuresAr : plan.features);
            const name = isAr ? (plan.displayNameAr || plan.displayName) : plan.displayName;

            const monthlyPrice = plan.monthlyPrice;
            const yearlyPrice = plan.yearlyPrice || Math.round(monthlyPrice * 12 * (1 - yearlyDiscount / 100));
            const yearlyMonthly = Math.round((yearlyPrice / 12) * 100) / 100;
            const price = isYearly ? yearlyMonthly : monthlyPrice;
            const showSave = isYearly && monthlyPrice > 0;

            return (
              <div
                key={plan.plan}
                className={cn(
                  'relative flex flex-col rounded-xl border p-8',
                  plan.isPopular
                    ? 'border-primary shadow-lg md:scale-105'
                    : 'border-border shadow-sm'
                )}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-medium text-primary-foreground">
                    {t('popular')}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold">{name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">
                      {price === 0 ? t('freeLabel') : `$${price}`}
                    </span>
                    {price > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {t('perMonth')}
                      </span>
                    )}
                  </div>
                  {showSave && (
                    <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                      {t('savings', { amount: Math.round((monthlyPrice * 12) - yearlyPrice) })}
                    </p>
                  )}
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={cn(
                    'block rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    plan.isPopular
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border hover:bg-accent'
                  )}
                >
                  {t('getStarted')}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Enterprise CTA */}
        {enterpriseCtaText && (
          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              {t('enterpriseCta')}
            </p>
            <a
              href={enterpriseCtaLink || '/contact'}
              className="inline-flex items-center gap-2 rounded-lg border border-primary px-6 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {enterpriseCtaText}
              <Arrow className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

function parseFeatures(featuresStr: string): string[] {
  try {
    return JSON.parse(featuresStr);
  } catch {
    return [];
  }
}
