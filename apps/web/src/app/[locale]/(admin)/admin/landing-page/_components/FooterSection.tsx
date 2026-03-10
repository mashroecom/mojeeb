'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Plus, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FooterLink {
  label: { en: string; ar: string };
  url: string;
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
// Props
// ---------------------------------------------------------------------------

interface FooterSectionProps {
  footerLang: 'en' | 'ar';
  setFooterLang: (lang: 'en' | 'ar') => void;
  footerDescription: string;
  setFooterDescription: (value: string) => void;
  footerDescriptionAr: string;
  setFooterDescriptionAr: (value: string) => void;
  footerCopyrightText: string;
  setFooterCopyrightText: (value: string) => void;
  footerCopyrightTextAr: string;
  setFooterCopyrightTextAr: (value: string) => void;
  footerShowSocialLinks: boolean;
  setFooterShowSocialLinks: (value: boolean) => void;
  footerTwitter: string;
  setFooterTwitter: (value: string) => void;
  footerLinkedin: string;
  setFooterLinkedin: (value: string) => void;
  footerInstagram: string;
  setFooterInstagram: (value: string) => void;
  footerFacebook: string;
  setFooterFacebook: (value: string) => void;
  footerLinks: FooterLink[];
  addFooterLink: () => void;
  removeFooterLink: (index: number) => void;
  updateFooterLink: (index: number, field: string, value: string) => void;
  customCss: string;
  setCustomCss: (value: string) => void;
  markChanged: () => void;
}

// ---------------------------------------------------------------------------
// FooterSection Component
// ---------------------------------------------------------------------------

export function FooterSection({
  footerLang,
  setFooterLang,
  footerDescription,
  setFooterDescription,
  footerDescriptionAr,
  setFooterDescriptionAr,
  footerCopyrightText,
  setFooterCopyrightText,
  footerCopyrightTextAr,
  setFooterCopyrightTextAr,
  footerShowSocialLinks,
  setFooterShowSocialLinks,
  footerTwitter,
  setFooterTwitter,
  footerLinkedin,
  setFooterLinkedin,
  footerInstagram,
  setFooterInstagram,
  footerFacebook,
  setFooterFacebook,
  footerLinks,
  addFooterLink,
  removeFooterLink,
  updateFooterLink,
  customCss,
  setCustomCss,
  markChanged,
}: FooterSectionProps) {
  const t = useTranslations('AdminLandingPage');

  const inputCls =
    'mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30';
  const textareaCls = `${inputCls} resize-none`;

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('footerSection')}
        description={t('footerSectionDesc')}
        showToggle={false}
      />
      <LangTabs lang={footerLang} setLang={setFooterLang} />
      <div>
        <label className="text-sm font-medium">
          {t('footerDescriptionLabel')} ({footerLang === 'en' ? 'EN' : 'AR'})
        </label>
        <textarea
          dir={footerLang === 'ar' ? 'rtl' : 'ltr'}
          value={footerLang === 'en' ? footerDescription : footerDescriptionAr}
          onChange={(e) => {
            if (footerLang === 'en') setFooterDescription(e.target.value);
            else setFooterDescriptionAr(e.target.value);
            markChanged();
          }}
          rows={2}
          className={textareaCls}
          placeholder={
            footerLang === 'en'
              ? 'Short description shown under the logo...'
              : 'وصف قصير يظهر تحت الشعار...'
          }
        />
      </div>
      <div>
        <label className="text-sm font-medium">
          {t('copyrightText')} ({footerLang === 'en' ? 'EN' : 'AR'})
        </label>
        <input
          type="text"
          dir={footerLang === 'ar' ? 'rtl' : 'ltr'}
          value={footerLang === 'en' ? footerCopyrightText : footerCopyrightTextAr}
          onChange={(e) => {
            if (footerLang === 'en') setFooterCopyrightText(e.target.value);
            else setFooterCopyrightTextAr(e.target.value);
            markChanged();
          }}
          className={inputCls}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4">
        <p className="text-sm font-medium">{t('showSocialLinks')}</p>
        <ToggleSwitch
          value={footerShowSocialLinks}
          onChange={() => {
            setFooterShowSocialLinks(!footerShowSocialLinks);
            markChanged();
          }}
        />
      </div>
      {footerShowSocialLinks && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Twitter/X URL</label>
            <input
              type="text"
              value={footerTwitter}
              onChange={(e) => {
                setFooterTwitter(e.target.value);
                markChanged();
              }}
              placeholder="https://twitter.com/..."
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm font-medium">LinkedIn URL</label>
            <input
              type="text"
              value={footerLinkedin}
              onChange={(e) => {
                setFooterLinkedin(e.target.value);
                markChanged();
              }}
              placeholder="https://linkedin.com/..."
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Instagram URL</label>
            <input
              type="text"
              value={footerInstagram}
              onChange={(e) => {
                setFooterInstagram(e.target.value);
                markChanged();
              }}
              placeholder="https://instagram.com/..."
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Facebook URL</label>
            <input
              type="text"
              value={footerFacebook}
              onChange={(e) => {
                setFooterFacebook(e.target.value);
                markChanged();
              }}
              placeholder="https://facebook.com/..."
              className={inputCls}
            />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('footerLinksLabel')}</h3>
        <button
          onClick={addFooterLink}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('addLink')}
        </button>
      </div>
      {footerLinks.map((link, i) => (
        <div key={i} className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Link #{i + 1}</span>
            <button
              onClick={() => removeFooterLink(i)}
              className="text-red-500 hover:text-red-700 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Label (EN)</label>
              <input
                type="text"
                value={link.label.en}
                onChange={(e) => updateFooterLink(i, 'labelEn', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Label (AR)</label>
              <input
                type="text"
                dir="rtl"
                value={link.label.ar}
                onChange={(e) => updateFooterLink(i, 'labelAr', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">URL</label>
              <input
                type="text"
                value={link.url}
                onChange={(e) => updateFooterLink(i, 'url', e.target.value)}
                placeholder="/privacy"
                className={inputCls}
              />
            </div>
          </div>
        </div>
      ))}
      <div>
        <label className="text-sm font-medium">{t('customCss')}</label>
        <p className="text-xs text-muted-foreground mb-1">{t('customCssDesc')}</p>
        <textarea
          value={customCss}
          onChange={(e) => {
            setCustomCss(e.target.value);
            markChanged();
          }}
          rows={4}
          className={`${textareaCls} font-mono`}
          placeholder=".hero { background: linear-gradient(...); }"
        />
      </div>
    </div>
  );
}
