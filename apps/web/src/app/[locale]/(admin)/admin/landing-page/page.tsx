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
  Plus,
  Trash2,
  HelpCircle,
  Megaphone,
  Shield,
  Search,
  GripVertical,
  Upload,
  X,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Settings,
  Image as ImageIcon,
  BarChart3,
} from 'lucide-react';
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

interface FooterLink {
  label: { en: string; ar: string };
  url: string;
}

interface TrustedByLogo {
  image: string;
  name: string;
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

const SECTION_LABELS: Record<string, { en: string; ar: string }> = {
  hero: { en: 'Hero', ar: 'الرئيسي' },
  trustedBy: { en: 'Trusted By', ar: 'موثوق من' },
  features: { en: 'Features', ar: 'المميزات' },
  stats: { en: 'Stats', ar: 'الإحصائيات' },
  pricing: { en: 'Pricing', ar: 'الأسعار' },
  testimonials: { en: 'Testimonials', ar: 'آراء العملاء' },
  faq: { en: 'FAQ', ar: 'الأسئلة الشائعة' },
  bottomCta: { en: 'Bottom CTA', ar: 'دعوة للعمل' },
};

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

  // Trusted By logo helpers
  function addLogo() {
    setTrustedByLogos((p) => [...p, { image: '', name: '' }]);
    markChanged();
  }
  function removeLogo(i: number) {
    setTrustedByLogos((p) => p.filter((_, idx) => idx !== i));
    markChanged();
  }
  async function uploadLogo(i: number, file: File) {
    try {
      const result = await uploadImage.mutateAsync(file);
      setTrustedByLogos((p) =>
        p.map((item, idx) => (idx === i ? { ...item, image: result.url } : item)),
      );
      markChanged();
    } catch {
      addToast('error', 'Upload failed');
    }
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

  const inputCls =
    'mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30';
  const textareaCls = `${inputCls} resize-none`;

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
          <div className="space-y-4">
            <SectionHeader
              title={t('heroSection')}
              description={t('heroSectionDesc')}
              enabled={heroEnabled}
              onToggle={() => {
                setHeroEnabled(!heroEnabled);
                markChanged();
              }}
            />
            <LangTabs lang={heroLang} setLang={setHeroLang} />
            {heroLang === 'en' ? (
              <>
                <div>
                  <label className="text-sm font-medium">{t('heroTitle')} (EN)</label>
                  <input
                    type="text"
                    value={heroTitle}
                    onChange={(e) => {
                      setHeroTitle(e.target.value);
                      markChanged();
                    }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('heroSubtitle')} (EN)</label>
                  <textarea
                    value={heroSubtitle}
                    onChange={(e) => {
                      setHeroSubtitle(e.target.value);
                      markChanged();
                    }}
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
                      onChange={(e) => {
                        setHeroCta(e.target.value);
                        markChanged();
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('badgeText')} (EN)</label>
                    <input
                      type="text"
                      value={badgeText}
                      onChange={(e) => {
                        setBadgeText(e.target.value);
                        markChanged();
                      }}
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
                    onChange={(e) => {
                      setHeroTitleAr(e.target.value);
                      markChanged();
                    }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('heroSubtitle')} (AR)</label>
                  <textarea
                    dir="rtl"
                    value={heroSubtitleAr}
                    onChange={(e) => {
                      setHeroSubtitleAr(e.target.value);
                      markChanged();
                    }}
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
                      onChange={(e) => {
                        setHeroCtaAr(e.target.value);
                        markChanged();
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('badgeText')} (AR)</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={badgeTextAr}
                      onChange={(e) => {
                        setBadgeTextAr(e.target.value);
                        markChanged();
                      }}
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
                onChange={(e) => {
                  setHeroCtaLink(e.target.value);
                  markChanged();
                }}
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
                        onClick={() => {
                          setHeroImage(null);
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
                      onChange={(e) => handleImageUpload(e, setHeroImage)}
                    />
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4">
                <p className="text-sm font-medium">{t('showNoCreditCard')}</p>
                <ToggleSwitch
                  value={showNoCreditCard}
                  onChange={() => {
                    setShowNoCreditCard(!showNoCreditCard);
                    markChanged();
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ===== Trusted By ===== */}
        {activeTab === 'trustedBy' && (
          <div className="space-y-4">
            <SectionHeader
              title={t('trustedBySection')}
              description={t('trustedBySectionDesc')}
              enabled={trustedByEnabled}
              onToggle={() => {
                setTrustedByEnabled(!trustedByEnabled);
                markChanged();
              }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{t('trustedByTitleLabel')} (EN)</label>
                <input
                  type="text"
                  value={trustedByTitle}
                  onChange={(e) => {
                    setTrustedByTitle(e.target.value);
                    markChanged();
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('trustedByTitleLabel')} (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={trustedByTitleAr}
                  onChange={(e) => {
                    setTrustedByTitleAr(e.target.value);
                    markChanged();
                  }}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('logos')}</h3>
              <button
                onClick={addLogo}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t('addLogo')}
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trustedByLogos.map((logo, i) => (
                <div key={i} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Logo #{i + 1}
                    </span>
                    <button
                      onClick={() => removeLogo(i)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {logo.image ? (
                    <img src={logo.image} alt={logo.name} className="h-12 object-contain" />
                  ) : (
                    <label className="flex items-center justify-center h-12 rounded-lg border-2 border-dashed cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadLogo(i, f);
                        }}
                      />
                    </label>
                  )}
                  <input
                    type="text"
                    value={logo.name}
                    placeholder={t('companyName')}
                    onChange={(e) => {
                      setTrustedByLogos((p) =>
                        p.map((item, idx) =>
                          idx === i ? { ...item, name: e.target.value } : item,
                        ),
                      );
                      markChanged();
                    }}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== Features ===== */}
        {activeTab === 'features' && (
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
        )}

        {/* ===== Stats ===== */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            <SectionHeader
              title={t('statsSection')}
              description={t('statsSectionDesc')}
              enabled={statsEnabled}
              onToggle={() => {
                setStatsEnabled(!statsEnabled);
                markChanged();
              }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{t('statsCustomers')}</label>
                <input
                  type="text"
                  value={statsCustomers}
                  onChange={(e) => {
                    setStatsCustomers(e.target.value);
                    markChanged();
                  }}
                  placeholder="500+"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('statsMessages')}</label>
                <input
                  type="text"
                  value={statsMessages}
                  onChange={(e) => {
                    setStatsMessages(e.target.value);
                    markChanged();
                  }}
                  placeholder="10M+"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('statsLanguages')}</label>
                <input
                  type="text"
                  value={statsLanguages}
                  onChange={(e) => {
                    setStatsLanguages(e.target.value);
                    markChanged();
                  }}
                  placeholder="20+"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('statsUptime')}</label>
                <input
                  type="text"
                  value={statsUptime}
                  onChange={(e) => {
                    setStatsUptime(e.target.value);
                    markChanged();
                  }}
                  placeholder="99.9%"
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        )}

        {/* ===== Pricing ===== */}
        {activeTab === 'pricing' && (
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
        )}

        {/* ===== Testimonials ===== */}
        {activeTab === 'testimonials' && (
          <div className="space-y-4">
            <SectionHeader
              title={t('testimonialsSection')}
              description={t('testimonialsSectionDesc')}
              enabled={testimonialsEnabled}
              onToggle={() => {
                setTestimonialsEnabled(!testimonialsEnabled);
                markChanged();
              }}
            />
            <LangTabs lang={testimonialsLang} setLang={setTestimonialsLang} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">
                  {t('sectionTitle')} ({testimonialsLang === 'en' ? 'EN' : 'AR'})
                </label>
                <input
                  type="text"
                  dir={testimonialsLang === 'ar' ? 'rtl' : 'ltr'}
                  value={testimonialsLang === 'en' ? testimonialsTitle : testimonialsTitleAr}
                  onChange={(e) => {
                    if (testimonialsLang === 'en') setTestimonialsTitle(e.target.value);
                    else setTestimonialsTitleAr(e.target.value);
                    markChanged();
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t('sectionSubtitle')} ({testimonialsLang === 'en' ? 'EN' : 'AR'})
                </label>
                <input
                  type="text"
                  dir={testimonialsLang === 'ar' ? 'rtl' : 'ltr'}
                  value={testimonialsLang === 'en' ? testimonialsSubtitle : testimonialsSubtitleAr}
                  onChange={(e) => {
                    if (testimonialsLang === 'en') setTestimonialsSubtitle(e.target.value);
                    else setTestimonialsSubtitleAr(e.target.value);
                    markChanged();
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
                value={testimonialsMaxDisplay}
                onChange={(e) => {
                  setTestimonialsMaxDisplay(Number(e.target.value));
                  markChanged();
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
        )}

        {/* ===== FAQ ===== */}
        {activeTab === 'faq' && (
          <div className="space-y-4">
            <SectionHeader
              title={t('faqSection')}
              description={t('faqSectionDesc')}
              enabled={faqEnabled}
              onToggle={() => {
                setFaqEnabled(!faqEnabled);
                markChanged();
              }}
            />
            <LangTabs lang={faqLang} setLang={setFaqLang} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">
                  {t('sectionTitle')} ({faqLang === 'en' ? 'EN' : 'AR'})
                </label>
                <input
                  type="text"
                  dir={faqLang === 'ar' ? 'rtl' : 'ltr'}
                  value={faqLang === 'en' ? faqTitle : faqTitleAr}
                  onChange={(e) => {
                    if (faqLang === 'en') setFaqTitle(e.target.value);
                    else setFaqTitleAr(e.target.value);
                    markChanged();
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t('sectionSubtitle')} ({faqLang === 'en' ? 'EN' : 'AR'})
                </label>
                <input
                  type="text"
                  dir={faqLang === 'ar' ? 'rtl' : 'ltr'}
                  value={faqLang === 'en' ? faqSubtitle : faqSubtitleAr}
                  onChange={(e) => {
                    if (faqLang === 'en') setFaqSubtitle(e.target.value);
                    else setFaqSubtitleAr(e.target.value);
                    markChanged();
                  }}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">{t('faqManageNote')}</p>
              <a
                href="/admin/faq"
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 mt-2"
              >
                {t('manageFaq')} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{t('maxDisplay')}</label>
                <select
                  value={faqMaxDisplay}
                  onChange={(e) => {
                    setFaqMaxDisplay(Number(e.target.value));
                    markChanged();
                  }}
                  className="mt-1 w-32 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  {[3, 5, 7, 10, 15].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4">
                <p className="text-sm font-medium">{t('showViewAll')}</p>
                <ToggleSwitch
                  value={faqShowViewAll}
                  onChange={() => {
                    setFaqShowViewAll(!faqShowViewAll);
                    markChanged();
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ===== Bottom CTA ===== */}
        {activeTab === 'bottomCta' && (
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
        )}

        {/* ===== Footer ===== */}
        {activeTab === 'footer' && (
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
        )}

        {/* ===== SEO ===== */}
        {activeTab === 'seo' && (
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
        )}

        {/* ===== Maintenance ===== */}
        {activeTab === 'maintenance' && (
          <div className="space-y-4">
            <SectionHeader
              title={t('maintenanceSection')}
              description={t('maintenanceSectionDesc')}
              showToggle={false}
            />
            <div className="flex items-center justify-between rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                    {t('enableMaintenance')}
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    {t('enableMaintenanceDesc')}
                  </p>
                </div>
              </div>
              <ToggleSwitch
                value={maintenanceEnabled}
                onChange={() => {
                  setMaintenanceEnabled(!maintenanceEnabled);
                  markChanged();
                }}
              />
            </div>
            <LangTabs lang={maintenanceLang} setLang={setMaintenanceLang} />
            <div>
              <label className="text-sm font-medium">
                {t('maintenanceTitle')} ({maintenanceLang === 'en' ? 'EN' : 'AR'})
              </label>
              <input
                type="text"
                dir={maintenanceLang === 'ar' ? 'rtl' : 'ltr'}
                value={maintenanceLang === 'en' ? maintenanceTitle : maintenanceTitleAr}
                onChange={(e) => {
                  if (maintenanceLang === 'en') setMaintenanceTitle(e.target.value);
                  else setMaintenanceTitleAr(e.target.value);
                  markChanged();
                }}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                {t('maintenanceMsg')} ({maintenanceLang === 'en' ? 'EN' : 'AR'})
              </label>
              <textarea
                dir={maintenanceLang === 'ar' ? 'rtl' : 'ltr'}
                value={maintenanceLang === 'en' ? maintenanceMessage : maintenanceMessageAr}
                onChange={(e) => {
                  if (maintenanceLang === 'en') setMaintenanceMessage(e.target.value);
                  else setMaintenanceMessageAr(e.target.value);
                  markChanged();
                }}
                rows={3}
                className={textareaCls}
              />
            </div>
          </div>
        )}

        {/* ===== Section Order ===== */}
        {activeTab === 'sectionOrder' && (
          <div className="space-y-4">
            <SectionHeader
              title={t('sectionOrderTitle')}
              description={t('sectionOrderDesc')}
              showToggle={false}
            />
            <div className="space-y-2">
              {sectionOrder.map((key, i) => (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3"
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">
                    {SECTION_LABELS[key]?.en || key}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {SECTION_LABELS[key]?.ar || ''}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveSectionOrder(i, 'up')}
                      disabled={i === 0}
                      className="p-1 hover:bg-muted rounded disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => moveSectionOrder(i, 'down')}
                      disabled={i === sectionOrder.length - 1}
                      className="p-1 hover:bg-muted rounded disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
