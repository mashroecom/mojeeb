'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminLandingPage, useUpdateLandingPage, useUploadLandingImage } from '@/hooks/useAdmin';
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
  HelpCircle,
  Megaphone,
  Shield,
  Search,
  Settings,
  Image as ImageIcon,
  BarChart3,
} from 'lucide-react';

// Section Components
import { HeroSection } from './_components/HeroSection';
import { TrustedBySection } from './_components/TrustedBySection';
import { FeaturesSection } from './_components/FeaturesSection';
import { StatsSection } from './_components/StatsSection';
import { PricingSection } from './_components/PricingSection';
import { TestimonialsSection } from './_components/TestimonialsSection';
import { FAQSection } from './_components/FAQSection';
import { BottomCTASection } from './_components/BottomCTASection';
import { FooterSection } from './_components/FooterSection';
import { SEOSection } from './_components/SEOSection';
import { MaintenanceSection } from './_components/MaintenanceSection';
import { SectionOrderConfig } from './_components/SectionOrderConfig';

// Shared Utilities and Types
import type { FeatureItem, FooterLink, TrustedByLogo } from './_components/types';

// ---------------------------------------------------------------------------
// Tabs definition
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'hero', icon: Sparkles },
  { id: 'trustedBy', icon: ImageIcon },
  { id: 'features', icon: LayoutGrid },
  { id: 'stats', icon: BarChart3 },
  { id: 'pricing', icon: DollarSign },
  { id: 'testimonials', icon: MessageSquareQuote },
  { id: 'faq', icon: HelpCircle },
  { id: 'bottomCta', icon: Megaphone },
  { id: 'footer', icon: FileText },
  { id: 'seo', icon: Search },
  { id: 'maintenance', icon: Shield },
  { id: 'sectionOrder', icon: Settings },
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

const DEFAULT_SECTION_ORDER = [
  'hero',
  'trustedBy',
  'features',
  'stats',
  'pricing',
  'testimonials',
  'faq',
  'bottomCta',
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LandingPageCmsPage() {
  const t = useTranslations('admin.landingPage');
  const tc = useTranslations('admin.common');
  const addToast = useToastStore((s) => s.addToast);

  const { data, isLoading } = useAdminLandingPage();
  const updateLandingPage = useUpdateLandingPage();
  const uploadImage = useUploadLandingImage();

  const [activeTab, setActiveTab] = useState<TabId>('hero');
  const [hasChanges, setHasChanges] = useState(false);

  // --- Hero ---
  const [heroEnabled, setHeroEnabled] = useState(true);
  const [heroTitle, setHeroTitle] = useState('');
  const [heroTitleAr, setHeroTitleAr] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroSubtitleAr, setHeroSubtitleAr] = useState('');
  const [heroCta, setHeroCta] = useState('');
  const [heroCtaAr, setHeroCtaAr] = useState('');
  const [heroCtaLink, setHeroCtaLink] = useState('');
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [showNoCreditCard, setShowNoCreditCard] = useState(true);
  const [badgeText, setBadgeText] = useState('');
  const [badgeTextAr, setBadgeTextAr] = useState('');

  // --- Trusted By ---
  const [trustedByEnabled, setTrustedByEnabled] = useState(false);
  const [trustedByTitle, setTrustedByTitle] = useState('');
  const [trustedByTitleAr, setTrustedByTitleAr] = useState('');
  const [trustedByLogos, setTrustedByLogos] = useState<TrustedByLogo[]>([]);

  // --- Features ---
  const [featuresEnabled, setFeaturesEnabled] = useState(true);
  const [featuresTitle, setFeaturesTitle] = useState('');
  const [featuresTitleAr, setFeaturesTitleAr] = useState('');
  const [featuresSubtitle, setFeaturesSubtitle] = useState('');
  const [featuresSubtitleAr, setFeaturesSubtitleAr] = useState('');
  const [features, setFeatures] = useState<FeatureItem[]>([]);

  // --- Stats ---
  const [statsEnabled, setStatsEnabled] = useState(false);
  const [statsCustomers, setStatsCustomers] = useState('500+');
  const [statsMessages, setStatsMessages] = useState('10M+');
  const [statsLanguages, setStatsLanguages] = useState('20+');
  const [statsUptime, setStatsUptime] = useState('99.9%');

  // --- Pricing ---
  const [pricingEnabled, setPricingEnabled] = useState(true);
  const [pricingTitle, setPricingTitle] = useState('');
  const [pricingTitleAr, setPricingTitleAr] = useState('');
  const [pricingSubtitle, setPricingSubtitle] = useState('');
  const [pricingSubtitleAr, setPricingSubtitleAr] = useState('');
  const [showYearlyToggle, setShowYearlyToggle] = useState(true);
  const [yearlyDiscount, setYearlyDiscount] = useState(20);
  const [enterpriseCtaText, setEnterpriseCtaText] = useState('');
  const [enterpriseCtaTextAr, setEnterpriseCtaTextAr] = useState('');
  const [enterpriseCtaLink, setEnterpriseCtaLink] = useState('');

  // --- Testimonials ---
  const [testimonialsEnabled, setTestimonialsEnabled] = useState(true);
  const [testimonialsTitle, setTestimonialsTitle] = useState('');
  const [testimonialsTitleAr, setTestimonialsTitleAr] = useState('');
  const [testimonialsSubtitle, setTestimonialsSubtitle] = useState('');
  const [testimonialsSubtitleAr, setTestimonialsSubtitleAr] = useState('');
  const [testimonialsMaxDisplay, setTestimonialsMaxDisplay] = useState(3);

  // --- FAQ ---
  const [faqEnabled, setFaqEnabled] = useState(true);
  const [faqTitle, setFaqTitle] = useState('');
  const [faqTitleAr, setFaqTitleAr] = useState('');
  const [faqSubtitle, setFaqSubtitle] = useState('');
  const [faqSubtitleAr, setFaqSubtitleAr] = useState('');
  const [faqMaxDisplay, setFaqMaxDisplay] = useState(5);
  const [faqShowViewAll, setFaqShowViewAll] = useState(true);

  // --- Bottom CTA ---
  const [bottomCtaEnabled, setBottomCtaEnabled] = useState(true);
  const [bottomCtaTitle, setBottomCtaTitle] = useState('');
  const [bottomCtaTitleAr, setBottomCtaTitleAr] = useState('');
  const [bottomCtaSubtitle, setBottomCtaSubtitle] = useState('');
  const [bottomCtaSubtitleAr, setBottomCtaSubtitleAr] = useState('');
  const [bottomCtaButtonText, setBottomCtaButtonText] = useState('');
  const [bottomCtaButtonTextAr, setBottomCtaButtonTextAr] = useState('');
  const [bottomCtaButtonLink, setBottomCtaButtonLink] = useState('');

  // --- Footer ---
  const [footerDescription, setFooterDescription] = useState('');
  const [footerDescriptionAr, setFooterDescriptionAr] = useState('');
  const [footerCopyrightText, setFooterCopyrightText] = useState('');
  const [footerCopyrightTextAr, setFooterCopyrightTextAr] = useState('');
  const [footerShowSocialLinks, setFooterShowSocialLinks] = useState(true);
  const [footerTwitter, setFooterTwitter] = useState('');
  const [footerLinkedin, setFooterLinkedin] = useState('');
  const [footerInstagram, setFooterInstagram] = useState('');
  const [footerFacebook, setFooterFacebook] = useState('');
  const [footerLinks, setFooterLinks] = useState<FooterLink[]>([]);
  const [customCss, setCustomCss] = useState('');

  // --- SEO ---
  const [seoMetaTitle, setSeoMetaTitle] = useState('');
  const [seoMetaTitleAr, setSeoMetaTitleAr] = useState('');
  const [seoMetaDescription, setSeoMetaDescription] = useState('');
  const [seoMetaDescriptionAr, setSeoMetaDescriptionAr] = useState('');
  const [seoOgImage, setSeoOgImage] = useState<string | null>(null);
  const [seoGoogleAnalyticsId, setSeoGoogleAnalyticsId] = useState('');
  const [seoCustomHeadCode, setSeoCustomHeadCode] = useState('');
  const [seoCustomFooterCode, setSeoCustomFooterCode] = useState('');
  const [seoFavicon, setSeoFavicon] = useState<string | null>(null);

  // --- Maintenance ---
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceTitle, setMaintenanceTitle] = useState('');
  const [maintenanceTitleAr, setMaintenanceTitleAr] = useState('');
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceMessageAr, setMaintenanceMessageAr] = useState('');

  // --- Section Order ---
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_SECTION_ORDER);

  // Language tabs per section
  const [heroLang, setHeroLang] = useState<'en' | 'ar'>('en');
  const [featuresLang, setFeaturesLang] = useState<'en' | 'ar'>('en');
  const [pricingLang, setPricingLang] = useState<'en' | 'ar'>('en');
  const [testimonialsLang, setTestimonialsLang] = useState<'en' | 'ar'>('en');
  const [faqLang, setFaqLang] = useState<'en' | 'ar'>('en');
  const [bottomCtaLang, setBottomCtaLang] = useState<'en' | 'ar'>('en');
  const [footerLang, setFooterLang] = useState<'en' | 'ar'>('en');
  const [seoLang, setSeoLang] = useState<'en' | 'ar'>('en');
  const [maintenanceLang, setMaintenanceLang] = useState<'en' | 'ar'>('en');

  // Load data
  useEffect(() => {
    if (!data) return;
    const d = data as Record<string, any>;
    setHeroEnabled(d.heroEnabled ?? true);
    setHeroTitle(d.heroTitle || '');
    setHeroTitleAr(d.heroTitleAr || '');
    setHeroSubtitle(d.heroSubtitle || '');
    setHeroSubtitleAr(d.heroSubtitleAr || '');
    setHeroCta(d.heroCta || '');
    setHeroCtaAr(d.heroCtaAr || '');
    setHeroCtaLink(d.heroCtaLink || '');
    setHeroImage(d.heroImage || null);
    setShowNoCreditCard(d.showNoCreditCard ?? true);
    setBadgeText(d.badgeText || '');
    setBadgeTextAr(d.badgeTextAr || '');

    setTrustedByEnabled(d.trustedByEnabled ?? false);
    setTrustedByTitle(d.trustedByTitle || '');
    setTrustedByTitleAr(d.trustedByTitleAr || '');
    setTrustedByLogos(parseJsonArray(d.trustedByLogos, []));

    setFeaturesEnabled(d.featuresEnabled ?? true);
    setFeaturesTitle(d.featuresTitle || '');
    setFeaturesTitleAr(d.featuresTitleAr || '');
    setFeaturesSubtitle(d.featuresSubtitle || '');
    setFeaturesSubtitleAr(d.featuresSubtitleAr || '');
    setFeatures(parseJsonArray(d.features, []));

    setStatsEnabled(d.statsEnabled ?? false);
    setStatsCustomers(d.statsCustomers || '500+');
    setStatsMessages(d.statsMessages || '10M+');
    setStatsLanguages(d.statsLanguages || '20+');
    setStatsUptime(d.statsUptime || '99.9%');

    setPricingEnabled(d.pricingEnabled ?? true);
    setPricingTitle(d.pricingTitle || '');
    setPricingTitleAr(d.pricingTitleAr || '');
    setPricingSubtitle(d.pricingSubtitle || '');
    setPricingSubtitleAr(d.pricingSubtitleAr || '');
    setShowYearlyToggle(d.showYearlyToggle ?? true);
    setYearlyDiscount(d.yearlyDiscount ?? 20);
    setEnterpriseCtaText(d.enterpriseCtaText || '');
    setEnterpriseCtaTextAr(d.enterpriseCtaTextAr || '');
    setEnterpriseCtaLink(d.enterpriseCtaLink || '');

    setTestimonialsEnabled(d.testimonialsEnabled ?? true);
    setTestimonialsTitle(d.testimonialsTitle || '');
    setTestimonialsTitleAr(d.testimonialsTitleAr || '');
    setTestimonialsSubtitle(d.testimonialsSubtitle || '');
    setTestimonialsSubtitleAr(d.testimonialsSubtitleAr || '');
    setTestimonialsMaxDisplay(d.testimonialsMaxDisplay ?? 3);

    setFaqEnabled(d.faqEnabled ?? true);
    setFaqTitle(d.faqTitle || '');
    setFaqTitleAr(d.faqTitleAr || '');
    setFaqSubtitle(d.faqSubtitle || '');
    setFaqSubtitleAr(d.faqSubtitleAr || '');
    setFaqMaxDisplay(d.faqMaxDisplay ?? 5);
    setFaqShowViewAll(d.faqShowViewAll ?? true);

    setBottomCtaEnabled(d.bottomCtaEnabled ?? true);
    setBottomCtaTitle(d.bottomCtaTitle || '');
    setBottomCtaTitleAr(d.bottomCtaTitleAr || '');
    setBottomCtaSubtitle(d.bottomCtaSubtitle || '');
    setBottomCtaSubtitleAr(d.bottomCtaSubtitleAr || '');
    setBottomCtaButtonText(d.bottomCtaButtonText || '');
    setBottomCtaButtonTextAr(d.bottomCtaButtonTextAr || '');
    setBottomCtaButtonLink(d.bottomCtaButtonLink || '');

    setFooterDescription(d.footerText || '');
    setFooterDescriptionAr(d.footerTextAr || '');
    setFooterCopyrightText(d.footerCopyrightText || '');
    setFooterCopyrightTextAr(d.footerCopyrightTextAr || '');
    setFooterShowSocialLinks(d.footerShowSocialLinks ?? true);
    setFooterTwitter(d.footerTwitter || '');
    setFooterLinkedin(d.footerLinkedin || '');
    setFooterInstagram(d.footerInstagram || '');
    setFooterFacebook(d.footerFacebook || '');
    setFooterLinks(parseJsonArray(d.footerLinks, []));
    setCustomCss(d.customCss || '');

    setSeoMetaTitle(d.seoMetaTitle || '');
    setSeoMetaTitleAr(d.seoMetaTitleAr || '');
    setSeoMetaDescription(d.seoMetaDescription || '');
    setSeoMetaDescriptionAr(d.seoMetaDescriptionAr || '');
    setSeoOgImage(d.seoOgImage || null);
    setSeoGoogleAnalyticsId(d.seoGoogleAnalyticsId || '');
    setSeoCustomHeadCode(d.seoCustomHeadCode || '');
    setSeoCustomFooterCode(d.seoCustomFooterCode || '');
    setSeoFavicon(d.seoFavicon || null);

    setMaintenanceEnabled(d.maintenanceEnabled ?? false);
    setMaintenanceTitle(d.maintenanceTitle || '');
    setMaintenanceTitleAr(d.maintenanceTitleAr || '');
    setMaintenanceMessage(d.maintenanceMessage || '');
    setMaintenanceMessageAr(d.maintenanceMessageAr || '');

    // Ensure all known sections appear in the order (append any missing ones)
    const savedOrder = parseJsonArray<string>(d.sectionOrder, DEFAULT_SECTION_ORDER);
    const missing = DEFAULT_SECTION_ORDER.filter((s) => !savedOrder.includes(s));
    setSectionOrder([...savedOrder, ...missing]);
    setHasChanges(false);
  }, [data]);

  const markChanged = useCallback(() => setHasChanges(true), []);

  function handleSave() {
    const body: Record<string, unknown> = {
      heroEnabled,
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
      trustedByEnabled,
      trustedByTitle,
      trustedByTitleAr,
      trustedByLogos,
      featuresEnabled,
      featuresTitle,
      featuresTitleAr,
      featuresSubtitle,
      featuresSubtitleAr,
      features,
      statsEnabled,
      statsCustomers,
      statsMessages,
      statsLanguages,
      statsUptime,
      pricingEnabled,
      pricingTitle,
      pricingTitleAr,
      pricingSubtitle,
      pricingSubtitleAr,
      showYearlyToggle,
      yearlyDiscount,
      enterpriseCtaText,
      enterpriseCtaTextAr,
      enterpriseCtaLink,
      testimonialsEnabled,
      testimonialsTitle,
      testimonialsTitleAr,
      testimonialsSubtitle,
      testimonialsSubtitleAr,
      testimonialsMaxDisplay,
      faqEnabled,
      faqTitle,
      faqTitleAr,
      faqSubtitle,
      faqSubtitleAr,
      faqMaxDisplay,
      faqShowViewAll,
      bottomCtaEnabled,
      bottomCtaTitle,
      bottomCtaTitleAr,
      bottomCtaSubtitle,
      bottomCtaSubtitleAr,
      bottomCtaButtonText,
      bottomCtaButtonTextAr,
      bottomCtaButtonLink,
      footerCopyrightText,
      footerCopyrightTextAr,
      footerShowSocialLinks,
      footerTwitter,
      footerLinkedin,
      footerInstagram,
      footerFacebook,
      footerLinks,
      footerText: footerDescription,
      footerTextAr: footerDescriptionAr,
      customCss,
      seoMetaTitle,
      seoMetaTitleAr,
      seoMetaDescription,
      seoMetaDescriptionAr,
      seoOgImage,
      seoGoogleAnalyticsId,
      seoCustomHeadCode: seoCustomHeadCode || null,
      seoCustomFooterCode: seoCustomFooterCode || null,
      seoFavicon,
      maintenanceEnabled,
      maintenanceTitle,
      maintenanceTitleAr,
      maintenanceMessage,
      maintenanceMessageAr,
      sectionOrder,
    };
    updateLandingPage.mutate(body, {
      onSuccess: () => {
        addToast('success', t('saved'));
        setHasChanges(false);
      },
      onError: () => addToast('error', tc('error')),
    });
  }

  // Image upload helper
  async function handleImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string | null) => void,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadImage.mutateAsync(file);
      setter(result.url);
      markChanged();
    } catch {
      addToast('error', 'Upload failed');
    }
  }

  // Footer link helpers
  function addFooterLink() {
    setFooterLinks((p) => [...p, { label: { en: '', ar: '' }, url: '' }]);
    markChanged();
  }
  function removeFooterLink(i: number) {
    setFooterLinks((p) => p.filter((_, idx) => idx !== i));
    markChanged();
  }
  function updateFooterLink(i: number, field: string, value: string) {
    setFooterLinks((p) =>
      p.map((item, idx) => {
        if (idx !== i) return item;
        if (field === 'url') return { ...item, url: value };
        if (field === 'labelEn') return { ...item, label: { ...item.label, en: value } };
        if (field === 'labelAr') return { ...item, label: { ...item.label, ar: value } };
        return item;
      }),
    );
    markChanged();
  }

  // Section order helpers
  function moveSectionOrder(i: number, dir: 'up' | 'down') {
    setSectionOrder((p) => {
      const a = [...p];
      const t = dir === 'up' ? i - 1 : i + 1;
      if (t < 0 || t >= a.length) return p;
      [a[i], a[t]] = [a[t], a[i]];
      return a;
    });
    markChanged();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors shrink-0"
        >
          <ExternalLink className="h-4 w-4" />
          {t('preview')}
        </a>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-lg border bg-card p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id
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
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        {/* ===== Hero ===== */}
        {activeTab === 'hero' && (
          <HeroSection
            t={t}
            heroEnabled={heroEnabled}
            heroLang={heroLang}
            heroTitle={heroTitle}
            heroTitleAr={heroTitleAr}
            heroSubtitle={heroSubtitle}
            heroSubtitleAr={heroSubtitleAr}
            heroCta={heroCta}
            heroCtaAr={heroCtaAr}
            heroCtaLink={heroCtaLink}
            heroImage={heroImage}
            showNoCreditCard={showNoCreditCard}
            badgeText={badgeText}
            badgeTextAr={badgeTextAr}
            onToggleEnabled={() => {
              setHeroEnabled(!heroEnabled);
              markChanged();
            }}
            onLangChange={setHeroLang}
            onTitleChange={(value) => {
              setHeroTitle(value);
              markChanged();
            }}
            onTitleArChange={(value) => {
              setHeroTitleAr(value);
              markChanged();
            }}
            onSubtitleChange={(value) => {
              setHeroSubtitle(value);
              markChanged();
            }}
            onSubtitleArChange={(value) => {
              setHeroSubtitleAr(value);
              markChanged();
            }}
            onCtaChange={(value) => {
              setHeroCta(value);
              markChanged();
            }}
            onCtaArChange={(value) => {
              setHeroCtaAr(value);
              markChanged();
            }}
            onCtaLinkChange={(value) => {
              setHeroCtaLink(value);
              markChanged();
            }}
            onBadgeTextChange={(value) => {
              setBadgeText(value);
              markChanged();
            }}
            onBadgeTextArChange={(value) => {
              setBadgeTextAr(value);
              markChanged();
            }}
            onImageUpload={(e) => handleImageUpload(e, setHeroImage)}
            onImageRemove={() => {
              setHeroImage(null);
              markChanged();
            }}
            onToggleNoCreditCard={() => {
              setShowNoCreditCard(!showNoCreditCard);
              markChanged();
            }}
          />
        )}

        {/* ===== Trusted By ===== */}
        {activeTab === 'trustedBy' && (
          <TrustedBySection
            enabled={trustedByEnabled}
            onToggleEnabled={() => {
              setTrustedByEnabled(!trustedByEnabled);
              markChanged();
            }}
            title={trustedByTitle}
            onTitleChange={(value) => {
              setTrustedByTitle(value);
              markChanged();
            }}
            titleAr={trustedByTitleAr}
            onTitleArChange={(value) => {
              setTrustedByTitleAr(value);
              markChanged();
            }}
            logos={trustedByLogos}
            onLogosChange={setTrustedByLogos}
            onMarkChanged={markChanged}
            uploadImage={uploadImage}
            addToast={addToast}
            t={t}
          />
        )}

        {/* ===== Features ===== */}
        {activeTab === 'features' && (
          <FeaturesSection
            featuresEnabled={featuresEnabled}
            setFeaturesEnabled={setFeaturesEnabled}
            featuresTitle={featuresTitle}
            setFeaturesTitle={setFeaturesTitle}
            featuresTitleAr={featuresTitleAr}
            setFeaturesTitleAr={setFeaturesTitleAr}
            featuresSubtitle={featuresSubtitle}
            setFeaturesSubtitle={setFeaturesSubtitle}
            featuresSubtitleAr={featuresSubtitleAr}
            setFeaturesSubtitleAr={setFeaturesSubtitleAr}
            features={features}
            setFeatures={setFeatures}
            featuresLang={featuresLang}
            setFeaturesLang={setFeaturesLang}
            markChanged={markChanged}
          />
        )}

        {/* ===== Stats ===== */}
        {activeTab === 'stats' && (
          <StatsSection
            enabled={statsEnabled}
            onToggleEnabled={() => {
              setStatsEnabled(!statsEnabled);
              markChanged();
            }}
            customers={statsCustomers}
            onCustomersChange={(value) => {
              setStatsCustomers(value);
              markChanged();
            }}
            messages={statsMessages}
            onMessagesChange={(value) => {
              setStatsMessages(value);
              markChanged();
            }}
            languages={statsLanguages}
            onLanguagesChange={(value) => {
              setStatsLanguages(value);
              markChanged();
            }}
            uptime={statsUptime}
            onUptimeChange={(value) => {
              setStatsUptime(value);
              markChanged();
            }}
            translations={{
              title: t('statsSection'),
              description: t('statsSectionDesc'),
              customersLabel: t('statsCustomers'),
              messagesLabel: t('statsMessages'),
              languagesLabel: t('statsLanguages'),
              uptimeLabel: t('statsUptime'),
            }}
          />
        )}

        {/* ===== Pricing ===== */}
        {activeTab === 'pricing' && (
          <PricingSection
            pricingEnabled={pricingEnabled}
            setPricingEnabled={setPricingEnabled}
            pricingTitle={pricingTitle}
            setPricingTitle={setPricingTitle}
            pricingTitleAr={pricingTitleAr}
            setPricingTitleAr={setPricingTitleAr}
            pricingSubtitle={pricingSubtitle}
            setPricingSubtitle={setPricingSubtitle}
            pricingSubtitleAr={pricingSubtitleAr}
            setPricingSubtitleAr={setPricingSubtitleAr}
            showYearlyToggle={showYearlyToggle}
            setShowYearlyToggle={setShowYearlyToggle}
            yearlyDiscount={yearlyDiscount}
            setYearlyDiscount={setYearlyDiscount}
            enterpriseCtaText={enterpriseCtaText}
            setEnterpriseCtaText={setEnterpriseCtaText}
            enterpriseCtaTextAr={enterpriseCtaTextAr}
            setEnterpriseCtaTextAr={setEnterpriseCtaTextAr}
            enterpriseCtaLink={enterpriseCtaLink}
            setEnterpriseCtaLink={setEnterpriseCtaLink}
            pricingLang={pricingLang}
            setPricingLang={setPricingLang}
            markChanged={markChanged}
            t={t}
          />
        )}

        {/* ===== Testimonials ===== */}
        {activeTab === 'testimonials' && (
          <TestimonialsSection
            enabled={testimonialsEnabled}
            onToggleEnabled={() => {
              setTestimonialsEnabled(!testimonialsEnabled);
              markChanged();
            }}
            title={testimonialsTitle}
            onTitleChange={setTestimonialsTitle}
            titleAr={testimonialsTitleAr}
            onTitleArChange={setTestimonialsTitleAr}
            subtitle={testimonialsSubtitle}
            onSubtitleChange={setTestimonialsSubtitle}
            subtitleAr={testimonialsSubtitleAr}
            onSubtitleArChange={setTestimonialsSubtitleAr}
            maxDisplay={testimonialsMaxDisplay}
            onMaxDisplayChange={setTestimonialsMaxDisplay}
            onMarkChanged={markChanged}
            t={t}
          />
        )}

        {/* ===== FAQ ===== */}
        {activeTab === 'faq' && (
          <FAQSection
            t={t}
            faqEnabled={faqEnabled}
            faqTitle={faqTitle}
            faqTitleAr={faqTitleAr}
            faqSubtitle={faqSubtitle}
            faqSubtitleAr={faqSubtitleAr}
            faqMaxDisplay={faqMaxDisplay}
            faqShowViewAll={faqShowViewAll}
            faqLang={faqLang}
            setFaqEnabled={setFaqEnabled}
            setFaqTitle={setFaqTitle}
            setFaqTitleAr={setFaqTitleAr}
            setFaqSubtitle={setFaqSubtitle}
            setFaqSubtitleAr={setFaqSubtitleAr}
            setFaqMaxDisplay={setFaqMaxDisplay}
            setFaqShowViewAll={setFaqShowViewAll}
            setFaqLang={setFaqLang}
            markChanged={markChanged}
          />
        )}

        {/* ===== Bottom CTA ===== */}
        {activeTab === 'bottomCta' && (
          <BottomCTASection
            t={t}
            bottomCtaEnabled={bottomCtaEnabled}
            bottomCtaTitle={bottomCtaTitle}
            bottomCtaTitleAr={bottomCtaTitleAr}
            bottomCtaSubtitle={bottomCtaSubtitle}
            bottomCtaSubtitleAr={bottomCtaSubtitleAr}
            bottomCtaButtonText={bottomCtaButtonText}
            bottomCtaButtonTextAr={bottomCtaButtonTextAr}
            bottomCtaButtonLink={bottomCtaButtonLink}
            bottomCtaLang={bottomCtaLang}
            setBottomCtaEnabled={setBottomCtaEnabled}
            setBottomCtaTitle={setBottomCtaTitle}
            setBottomCtaTitleAr={setBottomCtaTitleAr}
            setBottomCtaSubtitle={setBottomCtaSubtitle}
            setBottomCtaSubtitleAr={setBottomCtaSubtitleAr}
            setBottomCtaButtonText={setBottomCtaButtonText}
            setBottomCtaButtonTextAr={setBottomCtaButtonTextAr}
            setBottomCtaButtonLink={setBottomCtaButtonLink}
            setBottomCtaLang={setBottomCtaLang}
            markChanged={markChanged}
          />
        )}

        {/* ===== Footer ===== */}
        {activeTab === 'footer' && (
          <FooterSection
            footerLang={footerLang}
            setFooterLang={setFooterLang}
            footerDescription={footerDescription}
            setFooterDescription={setFooterDescription}
            footerDescriptionAr={footerDescriptionAr}
            setFooterDescriptionAr={setFooterDescriptionAr}
            footerCopyrightText={footerCopyrightText}
            setFooterCopyrightText={setFooterCopyrightText}
            footerCopyrightTextAr={footerCopyrightTextAr}
            setFooterCopyrightTextAr={setFooterCopyrightTextAr}
            footerShowSocialLinks={footerShowSocialLinks}
            setFooterShowSocialLinks={setFooterShowSocialLinks}
            footerTwitter={footerTwitter}
            setFooterTwitter={setFooterTwitter}
            footerLinkedin={footerLinkedin}
            setFooterLinkedin={setFooterLinkedin}
            footerInstagram={footerInstagram}
            setFooterInstagram={setFooterInstagram}
            footerFacebook={footerFacebook}
            setFooterFacebook={setFooterFacebook}
            footerLinks={footerLinks}
            addFooterLink={addFooterLink}
            removeFooterLink={removeFooterLink}
            updateFooterLink={updateFooterLink}
            customCss={customCss}
            setCustomCss={setCustomCss}
            markChanged={markChanged}
          />
        )}

        {/* ===== SEO ===== */}
        {activeTab === 'seo' && (
          <SEOSection
            seoMetaTitle={seoMetaTitle}
            seoMetaTitleAr={seoMetaTitleAr}
            seoMetaDescription={seoMetaDescription}
            seoMetaDescriptionAr={seoMetaDescriptionAr}
            seoOgImage={seoOgImage}
            seoFavicon={seoFavicon}
            seoGoogleAnalyticsId={seoGoogleAnalyticsId}
            seoCustomHeadCode={seoCustomHeadCode}
            seoCustomFooterCode={seoCustomFooterCode}
            setSeoMetaTitle={setSeoMetaTitle}
            setSeoMetaTitleAr={setSeoMetaTitleAr}
            setSeoMetaDescription={setSeoMetaDescription}
            setSeoMetaDescriptionAr={setSeoMetaDescriptionAr}
            setSeoOgImage={setSeoOgImage}
            setSeoFavicon={setSeoFavicon}
            setSeoGoogleAnalyticsId={setSeoGoogleAnalyticsId}
            setSeoCustomHeadCode={setSeoCustomHeadCode}
            setSeoCustomFooterCode={setSeoCustomFooterCode}
            markChanged={markChanged}
            handleImageUpload={handleImageUpload}
            t={t}
          />
        )}

        {/* ===== Maintenance ===== */}
        {activeTab === 'maintenance' && (
          <MaintenanceSection
            maintenanceEnabled={maintenanceEnabled}
            maintenanceTitle={maintenanceTitle}
            maintenanceTitleAr={maintenanceTitleAr}
            maintenanceMessage={maintenanceMessage}
            maintenanceMessageAr={maintenanceMessageAr}
            setMaintenanceEnabled={setMaintenanceEnabled}
            setMaintenanceTitle={setMaintenanceTitle}
            setMaintenanceTitleAr={setMaintenanceTitleAr}
            setMaintenanceMessage={setMaintenanceMessage}
            setMaintenanceMessageAr={setMaintenanceMessageAr}
            markChanged={markChanged}
            t={t}
          />
        )}

        {/* ===== Section Order ===== */}
        {activeTab === 'sectionOrder' && (
          <SectionOrderConfig
            sectionOrder={sectionOrder}
            onMove={moveSectionOrder}
            t={t}
          />
        )}
      </div>

      {/* Sticky Save Bar */}
      <div
        className={cn(
          'fixed bottom-0 inset-x-0 z-50 border-t bg-card/95 backdrop-blur-sm px-6 py-3 flex items-center justify-between transition-all duration-300',
          hasChanges ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-sm text-muted-foreground">{t('unsavedChanges')}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            {t('discardChanges')}
          </button>
          <button
            onClick={handleSave}
            disabled={updateLandingPage.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {updateLandingPage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t('saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}
