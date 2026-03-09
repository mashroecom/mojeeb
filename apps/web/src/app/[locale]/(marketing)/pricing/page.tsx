'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PricingSection } from '@/components/landing/PricingSection';
import { useLandingPageContent } from '@/hooks/useLandingPage';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  Zap,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const PRICING_FAQ_LIMIT = 3;

interface FAQ {
  id: string;
  question: string;
  questionAr: string;
  answer: string;
  answerAr: string;
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-start text-sm font-medium hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
      >
        <span>{question}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <p className="pb-5 text-sm leading-relaxed text-muted-foreground">
          {answer}
        </p>
      )}
    </div>
  );
}

export default function PricingPage() {
  const t = useTranslations('pricingPage');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const { data: cms } = useLandingPageContent();

  const { data: faqs } = useQuery({
    queryKey: ['public', 'faq'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/public/faq`);
      return data.data as FAQ[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const pricingTitle = isAr
    ? cms?.pricingTitleAr || cms?.pricingTitle || t('title')
    : cms?.pricingTitle || t('title');
  const pricingSubtitle = isAr
    ? cms?.pricingSubtitleAr || cms?.pricingSubtitle || t('subtitle')
    : cms?.pricingSubtitle || t('subtitle');

  return (
    <div>
      {/* Hero */}
      <section className="py-20 sm:py-28">
        <div className="container max-w-4xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {pricingTitle}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {pricingSubtitle}
          </p>
        </div>
      </section>

      {/* Pricing Cards (dynamic from DB) */}
      <section className="border-t bg-muted/30">
        <PricingSection
          showYearlyToggle={cms?.showYearlyToggle}
          yearlyDiscount={cms?.yearlyDiscount}
          enterpriseCtaText={(isAr ? cms?.enterpriseCtaTextAr : cms?.enterpriseCtaText) || undefined}
          enterpriseCtaLink={cms?.enterpriseCtaLink || undefined}
        />
      </section>

      {/* FAQ (dynamic from DB – show limited, link to /faq for rest) */}
      {faqs && faqs.length > 0 && (() => {
        const displayFaqs = faqs.slice(0, PRICING_FAQ_LIMIT);
        const hasMore = faqs.length > PRICING_FAQ_LIMIT;
        const Arrow = isAr ? ArrowLeft : ArrowRight;
        return (
          <section className="py-16 sm:py-24">
            <div className="container max-w-3xl">
              <div className="mb-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <HelpCircle className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-3xl font-bold">{t('faqTitle')}</h2>
                <p className="mt-2 text-muted-foreground">{t('faqSubtitle')}</p>
              </div>

              <div className="rounded-2xl border bg-card px-6">
                {displayFaqs.map((faq) => (
                  <FAQItem
                    key={faq.id}
                    question={isAr ? faq.questionAr || faq.question : faq.question}
                    answer={isAr ? faq.answerAr || faq.answer : faq.answer}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="mt-8 text-center">
                  <Link
                    href="/faq"
                    className="inline-flex items-center gap-2 rounded-lg border border-primary px-6 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    {t('viewAllFaqs')}
                    <Arrow className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* CTA */}
      <section className="border-t bg-muted/30 py-16 sm:py-24">
        <div className="container max-w-3xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">{t('ctaTitle')}</h2>
          <p className="mt-4 text-muted-foreground">{t('ctaSubtitle')}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className={cn(
                'inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              )}
            >
              {t('ctaButton')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {t('ctaContact')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
