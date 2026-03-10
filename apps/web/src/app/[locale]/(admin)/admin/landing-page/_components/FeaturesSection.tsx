'use client';

import { useTranslations } from 'next-intl';
import { Plus, Trash2, ChevronUp, ChevronDown, LayoutGrid } from 'lucide-react';
import { IconPicker } from '@/components/admin/IconPicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeatureItem {
  icon: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FeaturesSectionProps {
  featuresEnabled: boolean;
  setFeaturesEnabled: (value: boolean) => void;
  featuresTitle: string;
  setFeaturesTitle: (value: string) => void;
  featuresTitleAr: string;
  setFeaturesTitleAr: (value: string) => void;
  featuresSubtitle: string;
  setFeaturesSubtitle: (value: string) => void;
  featuresSubtitleAr: string;
  setFeaturesSubtitleAr: (value: string) => void;
  features: FeatureItem[];
  setFeatures: (value: FeatureItem[] | ((prev: FeatureItem[]) => FeatureItem[])) => void;
  featuresLang: 'en' | 'ar';
  setFeaturesLang: (value: 'en' | 'ar') => void;
  markChanged: () => void;
  inputCls: string;
  textareaCls: string;
  SectionHeader: React.ComponentType<{
    title: string;
    description: string;
    enabled?: boolean;
    onToggle?: () => void;
    showToggle?: boolean;
  }>;
  LangTabs: React.ComponentType<{
    lang: 'en' | 'ar';
    setLang: (l: 'en' | 'ar') => void;
  }>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeaturesSection({
  featuresEnabled,
  setFeaturesEnabled,
  featuresTitle,
  setFeaturesTitle,
  featuresTitleAr,
  setFeaturesTitleAr,
  featuresSubtitle,
  setFeaturesSubtitle,
  featuresSubtitleAr,
  setFeaturesSubtitleAr,
  features,
  setFeatures,
  featuresLang,
  setFeaturesLang,
  markChanged,
  inputCls,
  textareaCls,
  SectionHeader,
  LangTabs,
}: FeaturesSectionProps) {
  const t = useTranslations('admin.landingPage');

  // Feature helpers
  function addFeature() {
    setFeatures((p) => [
      ...p,
      { icon: '', title: '', titleAr: '', description: '', descriptionAr: '' },
    ]);
    markChanged();
  }

  function removeFeature(i: number) {
    setFeatures((p) => p.filter((_, idx) => idx !== i));
    markChanged();
  }

  function updateFeature(i: number, field: keyof FeatureItem, value: string) {
    setFeatures((p) => p.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
    markChanged();
  }

  function moveFeature(i: number, dir: 'up' | 'down') {
    setFeatures((p) => {
      const a = [...p];
      const t = dir === 'up' ? i - 1 : i + 1;
      if (t < 0 || t >= a.length) return p;
      [a[i], a[t]] = [a[t], a[i]];
      return a;
    });
    markChanged();
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('featuresSection')}
        description={t('featuresSectionDesc')}
        enabled={featuresEnabled}
        onToggle={() => {
          setFeaturesEnabled(!featuresEnabled);
          markChanged();
        }}
      />
      <LangTabs lang={featuresLang} setLang={setFeaturesLang} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">
            {t('featuresTitle')} ({featuresLang === 'en' ? 'EN' : 'AR'})
          </label>
          <input
            type="text"
            dir={featuresLang === 'ar' ? 'rtl' : 'ltr'}
            value={featuresLang === 'en' ? featuresTitle : featuresTitleAr}
            onChange={(e) => {
              if (featuresLang === 'en') setFeaturesTitle(e.target.value);
              else setFeaturesTitleAr(e.target.value);
              markChanged();
            }}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium">
            {t('featuresSubtitle')} ({featuresLang === 'en' ? 'EN' : 'AR'})
          </label>
          <input
            type="text"
            dir={featuresLang === 'ar' ? 'rtl' : 'ltr'}
            value={featuresLang === 'en' ? featuresSubtitle : featuresSubtitleAr}
            onChange={(e) => {
              if (featuresLang === 'en') setFeaturesSubtitle(e.target.value);
              else setFeaturesSubtitleAr(e.target.value);
              markChanged();
            }}
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('features')}</h3>
        <button
          onClick={addFeature}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          {t('addFeature')}
        </button>
      </div>
      {features.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <LayoutGrid className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t('noFeatures')}</p>
        </div>
      )}
      {features.map((feature, i) => (
        <div key={i} className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => moveFeature(i, 'up')}
                disabled={i === 0}
                className="p-1 hover:bg-muted rounded disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => moveFeature(i, 'down')}
                disabled={i === features.length - 1}
                className="p-1 hover:bg-muted rounded disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-muted-foreground">
                {t('feature')} #{i + 1}
              </span>
            </div>
            <button
              onClick={() => removeFeature(i)}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              {t('remove')}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <IconPicker
                label={t('icon')}
                value={feature.icon}
                onChange={(iconName) => updateFeature(i, 'icon', iconName)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t('featureTitle')} ({featuresLang === 'en' ? 'EN' : 'AR'})
              </label>
              <input
                type="text"
                dir={featuresLang === 'ar' ? 'rtl' : 'ltr'}
                value={featuresLang === 'en' ? feature.title : feature.titleAr}
                onChange={(e) =>
                  updateFeature(
                    i,
                    featuresLang === 'en' ? 'title' : 'titleAr',
                    e.target.value,
                  )
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t('featureDescription')} ({featuresLang === 'en' ? 'EN' : 'AR'})
              </label>
              <textarea
                dir={featuresLang === 'ar' ? 'rtl' : 'ltr'}
                value={featuresLang === 'en' ? feature.description : feature.descriptionAr}
                onChange={(e) =>
                  updateFeature(
                    i,
                    featuresLang === 'en' ? 'description' : 'descriptionAr',
                    e.target.value,
                  )
                }
                rows={2}
                className={textareaCls}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
