'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FAQSectionProps {
  // Translations
  t: (key: string) => string;
  // State
  faqEnabled: boolean;
  faqTitle: string;
  faqTitleAr: string;
  faqSubtitle: string;
  faqSubtitleAr: string;
  faqMaxDisplay: number;
  faqShowViewAll: boolean;
  faqLang: 'en' | 'ar';
  // Setters
  setFaqEnabled: (value: boolean) => void;
  setFaqTitle: (value: string) => void;
  setFaqTitleAr: (value: string) => void;
  setFaqSubtitle: (value: string) => void;
  setFaqSubtitleAr: (value: string) => void;
  setFaqMaxDisplay: (value: number) => void;
  setFaqShowViewAll: (value: boolean) => void;
  setFaqLang: (value: 'en' | 'ar') => void;
  // Callbacks
  markChanged: () => void;
}

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

function ToggleSwitch({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed',
        value ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          value
            ? 'ltr:translate-x-5 rtl:-translate-x-5'
            : 'ltr:translate-x-0.5 rtl:-translate-x-0.5',
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-4 border-b mb-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            'text-xs font-medium',
            enabled ? 'text-green-600' : 'text-muted-foreground',
          )}
        >
          {enabled ? 'ON' : 'OFF'}
        </span>
        <ToggleSwitch value={enabled} onChange={onToggle} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Language Tabs
// ---------------------------------------------------------------------------

function LangTabs({ lang, setLang }: { lang: 'en' | 'ar'; setLang: (l: 'en' | 'ar') => void }) {
  return (
    <div className="flex gap-1 rounded-lg border bg-muted/50 p-0.5 w-fit mb-4">
      <button
        onClick={() => setLang('en')}
        className={cn(
          'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
          lang === 'en'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        English
      </button>
      <button
        onClick={() => setLang('ar')}
        className={cn(
          'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
          lang === 'ar'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        العربية
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FAQ Section Component
// ---------------------------------------------------------------------------

export function FAQSection({
  t,
  faqEnabled,
  faqTitle,
  faqTitleAr,
  faqSubtitle,
  faqSubtitleAr,
  faqMaxDisplay,
  faqShowViewAll,
  faqLang,
  setFaqEnabled,
  setFaqTitle,
  setFaqTitleAr,
  setFaqSubtitle,
  setFaqSubtitleAr,
  setFaqMaxDisplay,
  setFaqShowViewAll,
  setFaqLang,
  markChanged,
}: FAQSectionProps) {
  const inputCls =
    'mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('faqSection')}
        description={t('faqSectionDesc')}
        enabled={faqEnabled}
        onToggle={() => {
          setFaqEnabled(!faqEnabled);
          markChanged();
        }}
      />
      <LangTabs lang={faqLang} setLang={setFaqLang} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">
            {t('sectionTitle')} ({faqLang === 'en' ? 'EN' : 'AR'})
          </label>
          <input
            type="text"
            dir={faqLang === 'ar' ? 'rtl' : 'ltr'}
            value={faqLang === 'en' ? faqTitle : faqTitleAr}
            onChange={(e) => {
              if (faqLang === 'en') setFaqTitle(e.target.value);
              else setFaqTitleAr(e.target.value);
              markChanged();
            }}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium">
            {t('sectionSubtitle')} ({faqLang === 'en' ? 'EN' : 'AR'})
          </label>
          <input
            type="text"
            dir={faqLang === 'ar' ? 'rtl' : 'ltr'}
            value={faqLang === 'en' ? faqSubtitle : faqSubtitleAr}
            onChange={(e) => {
              if (faqLang === 'en') setFaqSubtitle(e.target.value);
              else setFaqSubtitleAr(e.target.value);
              markChanged();
            }}
            className={inputCls}
          />
        </div>
      </div>
      <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">{t('faqManageNote')}</p>
        <a
          href="/admin/faq"
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 mt-2"
        >
          {t('manageFaq')} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">{t('maxDisplay')}</label>
          <select
            value={faqMaxDisplay}
            onChange={(e) => {
              setFaqMaxDisplay(Number(e.target.value));
              markChanged();
            }}
            className="mt-1 w-32 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {[3, 5, 7, 10, 15].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4">
          <p className="text-sm font-medium">{t('showViewAll')}</p>
          <ToggleSwitch
            value={faqShowViewAll}
            onChange={() => {
              setFaqShowViewAll(!faqShowViewAll);
              markChanged();
            }}
          />
        </div>
      </div>
    </div>
  );
}
