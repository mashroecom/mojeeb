'use client';

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BottomCTASectionProps {
  // Translations
  t: (key: string) => string;
  // State
  bottomCtaEnabled: boolean;
  bottomCtaTitle: string;
  bottomCtaTitleAr: string;
  bottomCtaSubtitle: string;
  bottomCtaSubtitleAr: string;
  bottomCtaButtonText: string;
  bottomCtaButtonTextAr: string;
  bottomCtaButtonLink: string;
  bottomCtaLang: 'en' | 'ar';
  // Setters
  setBottomCtaEnabled: (value: boolean) => void;
  setBottomCtaTitle: (value: string) => void;
  setBottomCtaTitleAr: (value: string) => void;
  setBottomCtaSubtitle: (value: string) => void;
  setBottomCtaSubtitleAr: (value: string) => void;
  setBottomCtaButtonText: (value: string) => void;
  setBottomCtaButtonTextAr: (value: string) => void;
  setBottomCtaButtonLink: (value: string) => void;
  setBottomCtaLang: (value: 'en' | 'ar') => void;
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
// Bottom CTA Section Component
// ---------------------------------------------------------------------------

export function BottomCTASection({
  t,
  bottomCtaEnabled,
  bottomCtaTitle,
  bottomCtaTitleAr,
  bottomCtaSubtitle,
  bottomCtaSubtitleAr,
  bottomCtaButtonText,
  bottomCtaButtonTextAr,
  bottomCtaButtonLink,
  bottomCtaLang,
  setBottomCtaEnabled,
  setBottomCtaTitle,
  setBottomCtaTitleAr,
  setBottomCtaSubtitle,
  setBottomCtaSubtitleAr,
  setBottomCtaButtonText,
  setBottomCtaButtonTextAr,
  setBottomCtaButtonLink,
  setBottomCtaLang,
  markChanged,
}: BottomCTASectionProps) {
  const inputCls =
    'mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30';
  const textareaCls = `${inputCls} resize-none`;

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('bottomCtaSection')}
        description={t('bottomCtaSectionDesc')}
        enabled={bottomCtaEnabled}
        onToggle={() => {
          setBottomCtaEnabled(!bottomCtaEnabled);
          markChanged();
        }}
      />
      <LangTabs lang={bottomCtaLang} setLang={setBottomCtaLang} />
      <div>
        <label className="text-sm font-medium">
          {t('ctaTitle')} ({bottomCtaLang === 'en' ? 'EN' : 'AR'})
        </label>
        <input
          type="text"
          dir={bottomCtaLang === 'ar' ? 'rtl' : 'ltr'}
          value={bottomCtaLang === 'en' ? bottomCtaTitle : bottomCtaTitleAr}
          onChange={(e) => {
            if (bottomCtaLang === 'en') setBottomCtaTitle(e.target.value);
            else setBottomCtaTitleAr(e.target.value);
            markChanged();
          }}
          className={inputCls}
        />
      </div>
      <div>
        <label className="text-sm font-medium">
          {t('ctaSubtitle')} ({bottomCtaLang === 'en' ? 'EN' : 'AR'})
        </label>
        <textarea
          dir={bottomCtaLang === 'ar' ? 'rtl' : 'ltr'}
          value={bottomCtaLang === 'en' ? bottomCtaSubtitle : bottomCtaSubtitleAr}
          onChange={(e) => {
            if (bottomCtaLang === 'en') setBottomCtaSubtitle(e.target.value);
            else setBottomCtaSubtitleAr(e.target.value);
            markChanged();
          }}
          rows={2}
          className={textareaCls}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">
            {t('ctaButtonText')} ({bottomCtaLang === 'en' ? 'EN' : 'AR'})
          </label>
          <input
            type="text"
            dir={bottomCtaLang === 'ar' ? 'rtl' : 'ltr'}
            value={bottomCtaLang === 'en' ? bottomCtaButtonText : bottomCtaButtonTextAr}
            onChange={(e) => {
              if (bottomCtaLang === 'en') setBottomCtaButtonText(e.target.value);
              else setBottomCtaButtonTextAr(e.target.value);
              markChanged();
            }}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium">{t('ctaButtonLink')}</label>
          <input
            type="text"
            value={bottomCtaButtonLink}
            onChange={(e) => {
              setBottomCtaButtonLink(e.target.value);
              markChanged();
            }}
            placeholder="/register"
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}
