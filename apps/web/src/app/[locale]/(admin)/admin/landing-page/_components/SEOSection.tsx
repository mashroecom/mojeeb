'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Upload, X } from 'lucide-react';
import { SectionHeader, LangTabs } from './shared';
import { inputCls, textareaCls } from './styles';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SEOSectionProps {
  // State
  seoMetaTitle: string;
  seoMetaTitleAr: string;
  seoMetaDescription: string;
  seoMetaDescriptionAr: string;
  seoOgImage: string | null;
  seoFavicon: string | null;
  seoGoogleAnalyticsId: string;
  seoCustomHeadCode: string;
  seoCustomFooterCode: string;

  // Setters
  setSeoMetaTitle: (value: string) => void;
  setSeoMetaTitleAr: (value: string) => void;
  setSeoMetaDescription: (value: string) => void;
  setSeoMetaDescriptionAr: (value: string) => void;
  setSeoOgImage: (value: string | null) => void;
  setSeoFavicon: (value: string | null) => void;
  setSeoGoogleAnalyticsId: (value: string) => void;
  setSeoCustomHeadCode: (value: string) => void;
  setSeoCustomFooterCode: (value: string) => void;

  // Callbacks
  markChanged: () => void;
  handleImageUpload: (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string | null) => void,
  ) => Promise<void>;

  // Translations
  t: (key: string) => string;
}

// ---------------------------------------------------------------------------
// SEO Section Component
// ---------------------------------------------------------------------------

export function SEOSection({
  seoMetaTitle,
  seoMetaTitleAr,
  seoMetaDescription,
  seoMetaDescriptionAr,
  seoOgImage,
  seoFavicon,
  seoGoogleAnalyticsId,
  seoCustomHeadCode,
  seoCustomFooterCode,
  setSeoMetaTitle,
  setSeoMetaTitleAr,
  setSeoMetaDescription,
  setSeoMetaDescriptionAr,
  setSeoOgImage,
  setSeoFavicon,
  setSeoGoogleAnalyticsId,
  setSeoCustomHeadCode,
  setSeoCustomFooterCode,
  markChanged,
  handleImageUpload,
  t,
}: SEOSectionProps) {
  const [seoLang, setSeoLang] = useState<'en' | 'ar'>('en');

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('seoSection')}
        description={t('seoSectionDesc')}
        showToggle={false}
      />
      <LangTabs lang={seoLang} setLang={setSeoLang} />
      <div>
        <label className="text-sm font-medium">
          {t('metaTitle')} ({seoLang === 'en' ? 'EN' : 'AR'})
        </label>
        <input
          type="text"
          dir={seoLang === 'ar' ? 'rtl' : 'ltr'}
          value={seoLang === 'en' ? seoMetaTitle : seoMetaTitleAr}
          onChange={(e) => {
            if (seoLang === 'en') setSeoMetaTitle(e.target.value);
            else setSeoMetaTitleAr(e.target.value);
            markChanged();
          }}
          className={inputCls}
        />
      </div>
      <div>
        <label className="text-sm font-medium">
          {t('metaDescription')} ({seoLang === 'en' ? 'EN' : 'AR'})
        </label>
        <textarea
          dir={seoLang === 'ar' ? 'rtl' : 'ltr'}
          value={seoLang === 'en' ? seoMetaDescription : seoMetaDescriptionAr}
          onChange={(e) => {
            if (seoLang === 'en') setSeoMetaDescription(e.target.value);
            else setSeoMetaDescriptionAr(e.target.value);
            markChanged();
          }}
          rows={3}
          className={textareaCls}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">{t('ogImage')}</label>
          <div className="mt-1 flex items-center gap-2">
            {seoOgImage && (
              <div className="relative">
                <img
                  src={seoOgImage}
                  alt=""
                  className="h-16 w-24 rounded-lg object-cover border"
                />
                <button
                  onClick={() => {
                    setSeoOgImage(null);
                    markChanged();
                  }}
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
                onChange={(e) => handleImageUpload(e, setSeoOgImage)}
              />
            </label>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">{t('favicon')}</label>
          <div className="mt-1 flex items-center gap-2">
            {seoFavicon && (
              <div className="relative">
                <img
                  src={seoFavicon}
                  alt=""
                  className="h-8 w-8 rounded object-cover border"
                />
                <button
                  onClick={() => {
                    setSeoFavicon(null);
                    markChanged();
                  }}
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
                accept="image/*,.ico"
                onChange={(e) => handleImageUpload(e, setSeoFavicon)}
              />
            </label>
          </div>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">{t('googleAnalyticsId')}</label>
        <input
          type="text"
          value={seoGoogleAnalyticsId}
          onChange={(e) => {
            setSeoGoogleAnalyticsId(e.target.value);
            markChanged();
          }}
          placeholder="G-XXXXXXXXXX"
          className={inputCls}
        />
      </div>
      <div>
        <label className="text-sm font-medium">{t('customHeadCode')}</label>
        <p className="text-xs text-muted-foreground mb-1">{t('customHeadCodeDesc')}</p>
        <textarea
          value={seoCustomHeadCode}
          onChange={(e) => {
            setSeoCustomHeadCode(e.target.value);
            markChanged();
          }}
          rows={4}
          className={`${textareaCls} font-mono`}
          placeholder="<script>...</script>"
        />
      </div>
      <div>
        <label className="text-sm font-medium">{t('customFooterCode')}</label>
        <p className="text-xs text-muted-foreground mb-1">{t('customFooterCodeDesc')}</p>
        <textarea
          value={seoCustomFooterCode}
          onChange={(e) => {
            setSeoCustomFooterCode(e.target.value);
            markChanged();
          }}
          rows={4}
          className={`${textareaCls} font-mono`}
          placeholder="<script>...</script>"
        />
      </div>
    </div>
  );
}
