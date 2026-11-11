'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { PublicFaq } from '@/hooks/useLandingPage';
import { localized } from './cms';

interface FAQSectionProps {
  title: string;
  subtitle: string;
  /** Active FAQs from GET /public/faq, already in display order */
  faqs: PublicFaq[];
  /** `faqMaxDisplay` from the CMS */
  maxDisplay: number;
  /** `faqShowViewAll` from the CMS — link to the full /faq page */
  showViewAll: boolean;
}

function FAQItem({ id, question, answer }: { id: string; question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const panelId = `landing-faq-panel-${id}`;
  return (
    <div className="border-b last:border-b-0">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-4 py-5 text-start text-sm font-medium transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:text-base"
        >
          <span>{question}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      </h3>
      {/* Always in the DOM (hidden while collapsed) so the answers are part of the server HTML */}
      <p
        id={panelId}
        hidden={!open}
        className="whitespace-pre-line pb-5 text-sm leading-relaxed text-muted-foreground"
      >
        {answer}
      </p>
    </div>
  );
}

/** FAQ accordion. Renders nothing when there are no questions to show. */
export function FAQSection({ title, subtitle, faqs, maxDisplay, showViewAll }: FAQSectionProps) {
  const t = useTranslations('landing.faq');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  const items = faqs
    .map((faq) => ({
      id: faq.id,
      question: localized(isAr, faq.question, faq.questionAr),
      answer: localized(isAr, faq.answer, faq.answerAr),
    }))
    .filter((item) => item.question && item.answer)
    .slice(0, maxDisplay);

  if (items.length === 0) return null;

  return (
    <section id="faq" className="py-20 scroll-mt-16">
      <div className="container max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold sm:text-4xl">{title}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{subtitle}</p>
        </div>

        <div className="rounded-2xl border bg-card px-6 shadow-sm">
          {items.map((item) => (
            <FAQItem key={item.id} id={item.id} question={item.question} answer={item.answer} />
          ))}
        </div>

        {showViewAll && (
          <div className="mt-8 text-center">
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 rounded-lg border border-primary px-6 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {t('viewAll')}
              <Arrow className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
