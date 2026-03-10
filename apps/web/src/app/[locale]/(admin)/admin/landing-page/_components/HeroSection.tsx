'use client';

import { cn } from '@/lib/utils';
import { Upload, X } from 'lucide-react';

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
  showToggle = true,
}: {
  title: string;
  description: string;
  enabled?: boolean;
  onToggle?: () => void;
  showToggle?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-4 border-b mb-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      {showToggle && onToggle && (
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
// HeroSection Component
// ---------------------------------------------------------------------------

interface HeroSectionProps {
  // Translations
  t: (key: string) => string;
  // State
  heroEnabled: boolean;
  heroLang: 'en' | 'ar';
  heroTitle: string;
  heroTitleAr: string;
  heroSubtitle: string;
  heroSubtitleAr: string;
  heroCta: string;
  heroCtaAr: string;
  heroCtaLink: string;
  heroImage: string | null;
  showNoCreditCard: boolean;
  badgeText: string;
  badgeTextAr: string;
  // Handlers
  onToggleEnabled: () => void;
  onLangChange: (lang: 'en' | 'ar') => void;
  onTitleChange: (value: string) => void;
  onTitleArChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onSubtitleArChange: (value: string) => void;
  onCtaChange: (value: string) => void;
  onCtaArChange: (value: string) => void;
  onCtaLinkChange: (value: string) => void;
  onBadgeTextChange: (value: string) => void;
  onBadgeTextArChange: (value: string) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageRemove: () => void;
  onToggleNoCreditCard: () => void;
}

export function HeroSection({
  t,
  heroEnabled,
  heroLang,
  heroTitle,
  heroTitleAr,
  heroSubtitle,
  heroSubtitleAr,
  heroCta,
  heroCtaAr,
  heroCtaLink,
  heroImage,
  showNoCreditCard,
  badgeText,
  badgeTextAr,
  onToggleEnabled,
  onLangChange,
  onTitleChange,
  onTitleArChange,
  onSubtitleChange,
  onSubtitleArChange,
  onCtaChange,
  onCtaArChange,
  onCtaLinkChange,
  onBadgeTextChange,
  onBadgeTextArChange,
  onImageUpload,
  onImageRemove,
  onToggleNoCreditCard,
}: HeroSectionProps) {
  const inputCls =
    'mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30';
  const textareaCls = `${inputCls} resize-none`;

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('heroSection')}
        description={t('heroSectionDesc')}
        enabled={heroEnabled}
        onToggle={onToggleEnabled}
      />
      <LangTabs lang={heroLang} setLang={onLangChange} />
      {heroLang === 'en' ? (
        <>
          <div>
            <label className="text-sm font-medium">{t('heroTitle')} (EN)</label>
            <input
              type="text"
              value={heroTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('heroSubtitle')} (EN)</label>
            <textarea
              value={heroSubtitle}
              onChange={(e) => onSubtitleChange(e.target.value)}
              rows={3}
              className={textareaCls}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">{t('heroCta')} (EN)</label>
              <input
                type="text"
                value={heroCta}
                onChange={(e) => onCtaChange(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('badgeText')} (EN)</label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => onBadgeTextChange(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="text-sm font-medium">{t('heroTitle')} (AR)</label>
            <input
              type="text"
              dir="rtl"
              value={heroTitleAr}
              onChange={(e) => onTitleArChange(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('heroSubtitle')} (AR)</label>
            <textarea
              dir="rtl"
              value={heroSubtitleAr}
              onChange={(e) => onSubtitleArChange(e.target.value)}
              rows={3}
              className={textareaCls}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">{t('heroCta')} (AR)</label>
              <input
                type="text"
                dir="rtl"
                value={heroCtaAr}
                onChange={(e) => onCtaArChange(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('badgeText')} (AR)</label>
              <input
                type="text"
                dir="rtl"
                value={badgeTextAr}
                onChange={(e) => onBadgeTextArChange(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </>
      )}
      <div>
        <label className="text-sm font-medium">{t('heroCtaLink')}</label>
        <input
          type="text"
          value={heroCtaLink}
          onChange={(e) => onCtaLinkChange(e.target.value)}
          placeholder="/register"
          className={inputCls}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">{t('heroImage')}</label>
          <div className="mt-1 flex items-center gap-2">
            {heroImage && (
              <div className="relative">
                <img
                  src={heroImage}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover border"
                />
                <button
                  onClick={onImageRemove}
                  className="absolute -top-1 -end-1 rounded-full bg-destructive text-destructive-foreground p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <label className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors">
              <Upload className="h-4 w-4" />
              {t('upload')}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={onImageUpload}
              />
            </label>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4">
          <p className="text-sm font-medium">{t('showNoCreditCard')}</p>
          <ToggleSwitch value={showNoCreditCard} onChange={onToggleNoCreditCard} />
        </div>
      </div>
    </div>
  );
}
