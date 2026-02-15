'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAdminLandingPage,
  useUpdateLandingPage,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Save,
  ExternalLink,
  Sparkles,
  LayoutGrid,
  MessageSquareQuote,
  DollarSign,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react';

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

interface TestimonialItem {
  name: string;
  role: string;
  quote: string;
  quoteAr: string;
}

interface LandingPageData {
  heroTitle: string;
  heroTitleAr: string;
  heroSubtitle: string;
  heroSubtitleAr: string;
  heroCta: string;
  heroCtaAr: string;
  heroCtaLink: string;
  featuresTitle: string;
  featuresTitleAr: string;
  features: FeatureItem[] | string;
  featuresAr: FeatureItem[] | string;
  statsEnabled: boolean;
  testimonialsEnabled: boolean;
  testimonials: TestimonialItem[] | string;
  testimonialsAr: TestimonialItem[] | string;
  pricingTitle: string;
  pricingTitleAr: string;
  pricingSubtitle: string;
  pricingSubtitleAr: string;
  footerText: string;
  footerTextAr: string;
  customCss: string;
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
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed',
        value ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          value ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Tabs definition
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'hero', icon: Sparkles },
  { id: 'features', icon: LayoutGrid },
  { id: 'testimonials', icon: MessageSquareQuote },
  { id: 'pricing', icon: DollarSign },
  { id: 'footer', icon: FileText },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonArray<T>(val: T[] | string | undefined | null, fallback: T[]): T[] {
  if (!val) return fallback;
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LandingPageCmsPage() {
  const t = useTranslations('admin.landingPage');
  const tc = useTranslations('admin.common');
  const addToast = useToastStore((s) => s.addToast);

  const { data, isLoading } = useAdminLandingPage();
  const updateLandingPage = useUpdateLandingPage();

  const [activeTab, setActiveTab] = useState<TabId>('hero');

  // Hero fields
  const [heroTitle, setHeroTitle] = useState('');
  const [heroTitleAr, setHeroTitleAr] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroSubtitleAr, setHeroSubtitleAr] = useState('');
  const [heroCta, setHeroCta] = useState('');
  const [heroCtaAr, setHeroCtaAr] = useState('');
  const [heroCtaLink, setHeroCtaLink] = useState('');

  // Features fields
  const [featuresTitle, setFeaturesTitle] = useState('');
  const [featuresTitleAr, setFeaturesTitleAr] = useState('');
  const [features, setFeatures] = useState<FeatureItem[]>([]);

  // Testimonials fields
  const [testimonialsEnabled, setTestimonialsEnabled] = useState(false);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);

  // Pricing fields
  const [pricingTitle, setPricingTitle] = useState('');
  const [pricingTitleAr, setPricingTitleAr] = useState('');
  const [pricingSubtitle, setPricingSubtitle] = useState('');
  const [pricingSubtitleAr, setPricingSubtitleAr] = useState('');

  // Footer fields
  const [footerText, setFooterText] = useState('');
  const [footerTextAr, setFooterTextAr] = useState('');
  const [customCss, setCustomCss] = useState('');
  const [statsEnabled, setStatsEnabled] = useState(false);

  // Load data
  useEffect(() => {
    if (data) {
      const d = data as LandingPageData;
      setHeroTitle(d.heroTitle || '');
      setHeroTitleAr(d.heroTitleAr || '');
      setHeroSubtitle(d.heroSubtitle || '');
      setHeroSubtitleAr(d.heroSubtitleAr || '');
      setHeroCta(d.heroCta || '');
      setHeroCtaAr(d.heroCtaAr || '');
      setHeroCtaLink(d.heroCtaLink || '');
      setFeaturesTitle(d.featuresTitle || '');
      setFeaturesTitleAr(d.featuresTitleAr || '');
      setFeatures(parseJsonArray(d.features, []));
      setTestimonialsEnabled(d.testimonialsEnabled ?? false);
      setTestimonials(parseJsonArray(d.testimonials, []));
      setPricingTitle(d.pricingTitle || '');
      setPricingTitleAr(d.pricingTitleAr || '');
      setPricingSubtitle(d.pricingSubtitle || '');
      setPricingSubtitleAr(d.pricingSubtitleAr || '');
      setFooterText(d.footerText || '');
      setFooterTextAr(d.footerTextAr || '');
      setCustomCss(d.customCss || '');
      setStatsEnabled(d.statsEnabled ?? false);
    }
  }, [data]);

  function handleSave() {
    const body: Record<string, unknown> = {
      heroTitle,
      heroTitleAr,
      heroSubtitle,
      heroSubtitleAr,
      heroCta,
      heroCtaAr,
      heroCtaLink,
      featuresTitle,
      featuresTitleAr,
      features,
      testimonialsEnabled,
      testimonials,
      pricingTitle,
      pricingTitleAr,
      pricingSubtitle,
      pricingSubtitleAr,
      footerText,
      footerTextAr,
      customCss,
      statsEnabled,
    };

    updateLandingPage.mutate(body, {
      onSuccess: () => addToast('success', t('saved')),
      onError: () => addToast('error', tc('error')),
    });
  }

  // Feature helpers
  function addFeature() {
    setFeatures((prev) => [
      ...prev,
      { icon: '', title: '', titleAr: '', description: '', descriptionAr: '' },
    ]);
  }

  function removeFeature(index: number) {
    setFeatures((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFeature(index: number, field: keyof FeatureItem, value: string) {
    setFeatures((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  // Testimonial helpers
  function addTestimonial() {
    setTestimonials((prev) => [
      ...prev,
      { name: '', role: '', quote: '', quoteAr: '' },
    ]);
  }

  function removeTestimonial(index: number) {
    setTestimonials((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTestimonial(index: number, field: keyof TestimonialItem, value: string) {
    setTestimonials((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            {t('preview')}
          </a>
          <button
            onClick={handleSave}
            disabled={updateLandingPage.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {updateLandingPage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t('save')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-lg border bg-card p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t(tab.id)}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        {/* ===== Hero Tab ===== */}
        {activeTab === 'hero' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">{t('heroSection')}</h2>
              <p className="text-sm text-muted-foreground">{t('heroSectionDesc')}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{t('heroTitle')} (EN)</label>
                <input
                  type="text"
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('heroTitle')} (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={heroTitleAr}
                  onChange={(e) => setHeroTitleAr(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('heroSubtitle')} (EN)</label>
                <textarea
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('heroSubtitle')} (AR)</label>
                <textarea
                  dir="rtl"
                  value={heroSubtitleAr}
                  onChange={(e) => setHeroSubtitleAr(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('heroCta')} (EN)</label>
                <input
                  type="text"
                  value={heroCta}
                  onChange={(e) => setHeroCta(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('heroCta')} (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={heroCtaAr}
                  onChange={(e) => setHeroCtaAr(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">{t('heroCtaLink')}</label>
                <input
                  type="text"
                  value={heroCtaLink}
                  onChange={(e) => setHeroCtaLink(e.target.value)}
                  placeholder="/register"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </div>
        )}

        {/* ===== Features Tab ===== */}
        {activeTab === 'features' && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold mb-1">{t('featuresSection')}</h2>
                <p className="text-sm text-muted-foreground">{t('featuresSectionDesc')}</p>
              </div>
              <button
                onClick={addFeature}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors shrink-0"
              >
                <Plus className="h-4 w-4" />
                {t('addFeature')}
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{t('featuresTitle')} (EN)</label>
                <input
                  type="text"
                  value={featuresTitle}
                  onChange={(e) => setFeaturesTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('featuresTitle')} (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={featuresTitleAr}
                  onChange={(e) => setFeaturesTitleAr(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {features.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <LayoutGrid className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">{t('noFeatures')}</p>
              </div>
            )}

            {features.map((feature, index) => (
              <div
                key={index}
                className="rounded-lg border bg-muted/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {t('feature')} #{index + 1}
                  </span>
                  <button
                    onClick={() => removeFeature(index)}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    {t('remove')}
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">{t('icon')}</label>
                    <input
                      type="text"
                      value={feature.icon}
                      onChange={(e) => updateFeature(index, 'icon', e.target.value)}
                      placeholder="MessageSquare"
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t('featureTitle')} (EN)</label>
                    <input
                      type="text"
                      value={feature.title}
                      onChange={(e) => updateFeature(index, 'title', e.target.value)}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t('featureTitle')} (AR)</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={feature.titleAr}
                      onChange={(e) => updateFeature(index, 'titleAr', e.target.value)}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t('featureDescription')} (EN)</label>
                    <textarea
                      value={feature.description}
                      onChange={(e) => updateFeature(index, 'description', e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t('featureDescription')} (AR)</label>
                    <textarea
                      dir="rtl"
                      value={feature.descriptionAr}
                      onChange={(e) => updateFeature(index, 'descriptionAr', e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== Testimonials Tab ===== */}
        {activeTab === 'testimonials' && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold mb-1">{t('testimonialsSection')}</h2>
                <p className="text-sm text-muted-foreground">{t('testimonialsSectionDesc')}</p>
              </div>
              <button
                onClick={addTestimonial}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors shrink-0"
              >
                <Plus className="h-4 w-4" />
                {t('addTestimonial')}
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">{t('enableTestimonials')}</p>
                <p className="text-xs text-muted-foreground">{t('enableTestimonialsDesc')}</p>
              </div>
              <ToggleSwitch
                value={testimonialsEnabled}
                onChange={() => setTestimonialsEnabled(!testimonialsEnabled)}
              />
            </div>

            {testimonials.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquareQuote className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">{t('noTestimonials')}</p>
              </div>
            )}

            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="rounded-lg border bg-muted/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {t('testimonial')} #{index + 1}
                  </span>
                  <button
                    onClick={() => removeTestimonial(index)}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    {t('remove')}
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t('name')}</label>
                    <input
                      type="text"
                      value={testimonial.name}
                      onChange={(e) => updateTestimonial(index, 'name', e.target.value)}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t('role')}</label>
                    <input
                      type="text"
                      value={testimonial.role}
                      onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t('quote')} (EN)</label>
                    <textarea
                      value={testimonial.quote}
                      onChange={(e) => updateTestimonial(index, 'quote', e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t('quote')} (AR)</label>
                    <textarea
                      dir="rtl"
                      value={testimonial.quoteAr}
                      onChange={(e) => updateTestimonial(index, 'quoteAr', e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== Pricing Tab ===== */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">{t('pricingSection')}</h2>
              <p className="text-sm text-muted-foreground">{t('pricingSectionDesc')}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{t('pricingTitle')} (EN)</label>
                <input
                  type="text"
                  value={pricingTitle}
                  onChange={(e) => setPricingTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('pricingTitle')} (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={pricingTitleAr}
                  onChange={(e) => setPricingTitleAr(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('pricingSubtitle')} (EN)</label>
                <textarea
                  value={pricingSubtitle}
                  onChange={(e) => setPricingSubtitle(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('pricingSubtitle')} (AR)</label>
                <textarea
                  dir="rtl"
                  value={pricingSubtitleAr}
                  onChange={(e) => setPricingSubtitleAr(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ===== Footer Tab ===== */}
        {activeTab === 'footer' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">{t('footerSection')}</h2>
              <p className="text-sm text-muted-foreground">{t('footerSectionDesc')}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{t('footerText')} (EN)</label>
                <textarea
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('footerText')} (AR)</label>
                <textarea
                  dir="rtl"
                  value={footerTextAr}
                  onChange={(e) => setFooterTextAr(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t('customCss')}</label>
              <p className="text-xs text-muted-foreground mb-1">{t('customCssDesc')}</p>
              <textarea
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                rows={6}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                placeholder=".hero { background: linear-gradient(...); }"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">{t('enableStats')}</p>
                <p className="text-xs text-muted-foreground">{t('enableStatsDesc')}</p>
              </div>
              <ToggleSwitch
                value={statsEnabled}
                onChange={() => setStatsEnabled(!statsEnabled)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={updateLandingPage.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {updateLandingPage.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t('save')}
        </button>
      </div>
    </div>
  );
}
