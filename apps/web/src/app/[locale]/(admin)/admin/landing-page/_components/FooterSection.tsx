'use client';

import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { SectionHeader, LangTabs, ToggleSwitch } from './shared';
import type { FooterLink } from './types';

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
