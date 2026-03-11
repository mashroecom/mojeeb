'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { SectionHeader, LangTabs } from './shared';
import { inputCls } from './styles';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TestimonialsSectionProps {
  enabled: boolean;
  onToggleEnabled: () => void;
  title: string;
  onTitleChange: (value: string) => void;
  titleAr: string;
  onTitleArChange: (value: string) => void;
  subtitle: string;
  onSubtitleChange: (value: string) => void;
  subtitleAr: string;
  onSubtitleArChange: (value: string) => void;
  maxDisplay: number;
  onMaxDisplayChange: (value: number) => void;
  onMarkChanged: () => void;
  t: (key: string) => string;
}

// ---------------------------------------------------------------------------
// TestimonialsSection Component
// ---------------------------------------------------------------------------

export function TestimonialsSection({
  enabled,
  onToggleEnabled,
  title,
  onTitleChange,
  titleAr,
  onTitleArChange,
  subtitle,
  onSubtitleChange,
  subtitleAr,
  onSubtitleArChange,
  maxDisplay,
  onMaxDisplayChange,
  onMarkChanged,
  t,
}: TestimonialsSectionProps) {
  const [lang, setLang] = React.useState<'en' | 'ar'>('en');

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('testimonialsSection')}
        description={t('testimonialsSectionDesc')}
        enabled={enabled}
        onToggle={onToggleEnabled}
      />
      <LangTabs lang={lang} setLang={setLang} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">
            {t('sectionTitle')} ({lang === 'en' ? 'EN' : 'AR'})
          </label>
          <input
            type="text"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            value={lang === 'en' ? title : titleAr}
            onChange={(e) => {
              if (lang === 'en') onTitleChange(e.target.value);
              else onTitleArChange(e.target.value);
              onMarkChanged();
            }}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium">
            {t('sectionSubtitle')} ({lang === 'en' ? 'EN' : 'AR'})
          </label>
          <input
            type="text"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            value={lang === 'en' ? subtitle : subtitleAr}
            onChange={(e) => {
              if (lang === 'en') onSubtitleChange(e.target.value);
              else onSubtitleArChange(e.target.value);
              onMarkChanged();
            }}
            className={inputCls}
          />
        </div>
      </div>
      <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {t('testimonialsManageNote')}
        </p>
        <a
          href="/admin/testimonials"
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 mt-2"
        >
          {t('manageTestimonials')} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div>
        <label className="text-sm font-medium">{t('maxDisplay')}</label>
        <select
          value={maxDisplay}
          onChange={(e) => {
            onMaxDisplayChange(Number(e.target.value));
            onMarkChanged();
          }}
          className="mt-1 w-32 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {[1, 2, 3, 4, 5, 6, 9, 12].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
