'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ChevronDown, HelpCircle, Loader2, MessageCircleQuestion, Search } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface FAQ {
  id: string;
  question: string;
  questionAr: string;
  answer: string;
  answerAr: string;
}

function FAQItem({ id, question, answer }: { id: string; question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const panelId = `faq-panel-${id}`;
  return (
    <div className="border-b last:border-b-0">
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
      {open && (
        <p
          id={panelId}
          className="whitespace-pre-line pb-5 text-sm leading-relaxed text-muted-foreground"
        >
          {answer}
        </p>
      )}
    </div>
  );
}

export default function FAQPage() {
  const t = useTranslations('faq');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const [search, setSearch] = useState('');

  const { data: faqs, isLoading } = useQuery({
    queryKey: ['public', 'faq'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/public/faq`);
      return data.data as FAQ[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Localize once, then filter on what the visitor actually reads
  const items = useMemo(
    () =>
      (faqs ?? []).map((faq) => ({
        id: faq.id,
        question: isAr ? faq.questionAr || faq.question : faq.question,
        answer: isAr ? faq.answerAr || faq.answer : faq.answer,
      })),
    [faqs, isAr],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) => item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <div>
      {/* Hero */}
      <section className="py-20 sm:py-28">
        <div className="container max-w-4xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t('pageTitle')}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {t('pageSubtitle')}
          </p>

          <div className="relative mx-auto mt-10 max-w-xl">
            <Search
              className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="w-full rounded-xl border bg-background py-3 pe-4 ps-11 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </section>

      {/* Questions */}
      <section className="border-t bg-muted/30 py-16 sm:py-24">
        <div className="container max-w-3xl">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border bg-card px-6 py-12 text-center">
              <MessageCircleQuestion className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t('noResults')}</p>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card px-6">
              {filtered.map((item) => (
                <FAQItem key={item.id} id={item.id} question={item.question} answer={item.answer} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 sm:py-24">
        <div className="container max-w-3xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">{t('stillHaveQuestions')}</h2>
          <p className="mt-4 text-muted-foreground">{t('contactSupport')}</p>
          <Link
            href="/contact"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {t('contactUs')}
          </Link>
        </div>
      </section>
    </div>
  );
}
