'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

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

const planColors: Record<string, string> = {
  FREE: 'border-border shadow-sm',
  STARTER: 'border-border shadow-sm',
  PROFESSIONAL: 'border-primary shadow-lg md:scale-105',
  ENTERPRISE: 'border-border shadow-sm',
};

export function PricingSection() {
  const t = useTranslations('landing.pricing');
  const locale = useLocale();
  const isAr = locale === 'ar';

  const { data: plans } = useQuery({
    queryKey: ['public', 'plans'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/public/plans`);
      return data.data as PlanData[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fallback to translation-based pricing if API not available
  if (!plans || plans.length === 0) {
    return <PricingSectionFallback />;
  }

  return (
    <section id="pricing" className="py-20 scroll-mt-16">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold sm:text-4xl">{t('title')}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className={cn(
          'mx-auto grid max-w-5xl grid-cols-1 gap-8',
          plans.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4',
        )}>
          {plans.map((plan) => {
            const features = parseFeatures(isAr ? plan.featuresAr : plan.features);
            const name = isAr ? (plan.displayNameAr || plan.displayName) : plan.displayName;
            const price = plan.monthlyPrice;

            return (
              <div
                key={plan.plan}
                className={cn(
                  'relative flex flex-col rounded-xl border p-8',
                  plan.isPopular
                    ? 'border-primary shadow-lg md:scale-105'
                    : planColors[plan.plan] || 'border-border shadow-sm'
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
                      {price === 0 ? (isAr ? 'مجاني' : 'Free') : `$${price}`}
                    </span>
                    {price > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {isAr ? '/شهر' : '/mo'}
                      </span>
                    )}
                  </div>
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
                    'block rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors',
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

// Fallback component that uses translation strings (original behavior)
function PricingSectionFallback() {
  const t = useTranslations('landing.pricing');
  const plans = ['free', 'starter', 'professional'] as const;

  return (
    <section id="pricing" className="py-20 scroll-mt-16">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold sm:text-4xl">{t('title')}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan) => {
            const isPopular = plan === 'professional';
            const features = t.raw(`${plan}.features`) as string[];

            return (
              <div
                key={plan}
                className={cn(
                  'relative flex flex-col rounded-xl border p-8',
                  isPopular
                    ? 'border-primary shadow-lg md:scale-105'
                    : 'border-border shadow-sm'
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-medium text-primary-foreground">
                    {t('popular')}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold">{t(`${plan}.name`)}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{t(`${plan}.price`)}</span>
                    <span className="text-sm text-muted-foreground">{t(`${plan}.period`)}</span>
                  </div>
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
                    'block rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors',
                    isPopular
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border hover:bg-accent'
                  )}
                >
                  {t(`${plan}.name`)}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
