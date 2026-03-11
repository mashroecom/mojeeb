import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

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
// Section Header with toggle
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-4 border-b mb-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      {onToggle && (
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              'text-xs font-medium',
              enabled ? 'text-green-600' : 'text-muted-foreground',
            )}
          >
            {enabled ? 'ON' : 'OFF'}
          </span>
          <ToggleSwitch value={!!enabled} onChange={onToggle} />
        </div>
      )}
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
// PricingSection Component
// ---------------------------------------------------------------------------

interface PricingSectionProps {
  pricingEnabled: boolean;
  setPricingEnabled: (val: boolean) => void;
  pricingTitle: string;
  setPricingTitle: (val: string) => void;
  pricingTitleAr: string;
  setPricingTitleAr: (val: string) => void;
  pricingSubtitle: string;
  setPricingSubtitle: (val: string) => void;
  pricingSubtitleAr: string;
  setPricingSubtitleAr: (val: string) => void;
  showYearlyToggle: boolean;
  setShowYearlyToggle: (val: boolean) => void;
  yearlyDiscount: number;
  setYearlyDiscount: (val: number) => void;
  enterpriseCtaText: string;
  setEnterpriseCtaText: (val: string) => void;
  enterpriseCtaTextAr: string;
  setEnterpriseCtaTextAr: (val: string) => void;
  enterpriseCtaLink: string;
  setEnterpriseCtaLink: (val: string) => void;
  pricingLang: 'en' | 'ar';
  setPricingLang: (val: 'en' | 'ar') => void;
  markChanged: () => void;
  t: (key: string) => string;
}

export function PricingSection({
  pricingEnabled,
  setPricingEnabled,
  pricingTitle,
  setPricingTitle,
  pricingTitleAr,
  setPricingTitleAr,
  pricingSubtitle,
  setPricingSubtitle,
  pricingSubtitleAr,
  setPricingSubtitleAr,
  showYearlyToggle,
  setShowYearlyToggle,
  yearlyDiscount,
  setYearlyDiscount,
  enterpriseCtaText,
  setEnterpriseCtaText,
  enterpriseCtaTextAr,
  setEnterpriseCtaTextAr,
  enterpriseCtaLink,
  setEnterpriseCtaLink,
  pricingLang,
  setPricingLang,
  markChanged,
  t,
}: PricingSectionProps) {
  const inputCls =
    'mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30';
  const textareaCls = `${inputCls} resize-none`;

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('pricingSection')}
        description={t('pricingSectionDesc')}
        enabled={pricingEnabled}
        onToggle={() => {
          setPricingEnabled(!pricingEnabled);
          markChanged();
        }}
      />
      <LangTabs lang={pricingLang} setLang={setPricingLang} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">
            {t('pricingTitle')} ({pricingLang === 'en' ? 'EN' : 'AR'})
          </label>
          <input
            type="text"
            dir={pricingLang === 'ar' ? 'rtl' : 'ltr'}
            value={pricingLang === 'en' ? pricingTitle : pricingTitleAr}
            onChange={(e) => {
              if (pricingLang === 'en') setPricingTitle(e.target.value);
              else setPricingTitleAr(e.target.value);
              markChanged();
            }}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium">
            {t('pricingSubtitle')} ({pricingLang === 'en' ? 'EN' : 'AR'})
          </label>
          <textarea
            dir={pricingLang === 'ar' ? 'rtl' : 'ltr'}
            value={pricingLang === 'en' ? pricingSubtitle : pricingSubtitleAr}
            onChange={(e) => {
              if (pricingLang === 'en') setPricingSubtitle(e.target.value);
              else setPricingSubtitleAr(e.target.value);
              markChanged();
            }}
            rows={2}
            className={textareaCls}
          />
        </div>
      </div>
      <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">{t('pricingPlansNote')}</p>
        <a
          href="/admin/plans"
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 mt-2"
        >
          {t('managePlans')} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4">
          <p className="text-sm font-medium">{t('showYearlyToggle')}</p>
          <ToggleSwitch
            value={showYearlyToggle}
            onChange={() => {
              setShowYearlyToggle(!showYearlyToggle);
              markChanged();
            }}
          />
        </div>
        <div>
          <label className="text-sm font-medium">{t('yearlyDiscount')}</label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              value={yearlyDiscount}
              min={0}
              max={100}
              onChange={(e) => {
                setYearlyDiscount(Number(e.target.value));
                markChanged();
              }}
              className="w-24 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">
            {t('enterpriseCtaText')} ({pricingLang === 'en' ? 'EN' : 'AR'})
          </label>
          <input
            type="text"
            dir={pricingLang === 'ar' ? 'rtl' : 'ltr'}
            value={pricingLang === 'en' ? enterpriseCtaText : enterpriseCtaTextAr}
            onChange={(e) => {
              if (pricingLang === 'en') setEnterpriseCtaText(e.target.value);
              else setEnterpriseCtaTextAr(e.target.value);
              markChanged();
            }}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium">{t('enterpriseCtaLink')}</label>
          <input
            type="text"
            value={enterpriseCtaLink}
            onChange={(e) => {
              setEnterpriseCtaLink(e.target.value);
              markChanged();
            }}
            placeholder="/contact"
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}
