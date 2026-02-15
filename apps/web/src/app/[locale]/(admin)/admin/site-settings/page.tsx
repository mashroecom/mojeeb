'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAdminSiteSettings,
  useUpdateSiteSettings,
  useUploadSiteLogo,
  useUploadSiteFavicon,
  useUploadSiteOgImage,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Save,
  Upload,
  Globe,
  Palette,
  Image as ImageIcon,
  Share2,
  Mail,
  AlertTriangle,
  Phone,
  MapPin,
  Clock,
  BarChart3,
  Code2,
  FileImage,
  Facebook,
  Instagram,
  Youtube,
} from 'lucide-react';

export default function SiteSettingsPage() {
  const t = useTranslations('admin.siteSettings');
  const tc = useTranslations('admin.common');
  const addToast = useToastStore((s) => s.addToast);

  const { data: settings, isLoading } = useAdminSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const uploadLogo = useUploadSiteLogo();
  const uploadFavicon = useUploadSiteFavicon();
  const uploadOgImage = useUploadSiteOgImage();

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const ogImageInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    siteName: '',
    description: '',
    keywords: '',
    primaryColor: '#6366f1',
    secondaryColor: '#ec4899',
    twitterUrl: '',
    linkedinUrl: '',
    githubUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    youtubeUrl: '',
    supportEmail: '',
    contactPhone: '',
    companyAddress: '',
    copyrightText: '',
    timezone: 'UTC',
    googleAnalyticsId: '',
    customHeadScripts: '',
    maintenanceMode: false,
    maintenanceMessage: '',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        siteName: settings.siteName || '',
        description: settings.description || '',
        keywords: settings.keywords || '',
        primaryColor: settings.primaryColor || '#6366f1',
        secondaryColor: settings.secondaryColor || '#ec4899',
        twitterUrl: settings.twitterUrl || '',
        linkedinUrl: settings.linkedinUrl || '',
        githubUrl: settings.githubUrl || '',
        facebookUrl: settings.facebookUrl || '',
        instagramUrl: settings.instagramUrl || '',
        youtubeUrl: settings.youtubeUrl || '',
        supportEmail: settings.supportEmail || '',
        contactPhone: settings.contactPhone || '',
        companyAddress: settings.companyAddress || '',
        copyrightText: settings.copyrightText || '',
        timezone: settings.timezone || 'UTC',
        googleAnalyticsId: settings.googleAnalyticsId || '',
        customHeadScripts: settings.customHeadScripts || '',
        maintenanceMode: settings.maintenanceMode || false,
        maintenanceMessage: settings.maintenanceMessage || '',
      });
    }
  }, [settings]);

  function handleSave() {
    updateSettings.mutate(
      {
        ...form,
        twitterUrl: form.twitterUrl || null,
        linkedinUrl: form.linkedinUrl || null,
        githubUrl: form.githubUrl || null,
        facebookUrl: form.facebookUrl || null,
        instagramUrl: form.instagramUrl || null,
        youtubeUrl: form.youtubeUrl || null,
        supportEmail: form.supportEmail || null,
        contactPhone: form.contactPhone || null,
        companyAddress: form.companyAddress || null,
        copyrightText: form.copyrightText || null,
        googleAnalyticsId: form.googleAnalyticsId || null,
        customHeadScripts: form.customHeadScripts || null,
        maintenanceMessage: form.maintenanceMessage || null,
      },
      {
        onSuccess: () => addToast('success', t('saved')),
      },
    );
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadLogo.mutate(file, {
        onSuccess: () => addToast('success', t('saved')),
      });
    }
  }

  function handleFaviconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadFavicon.mutate(file, {
        onSuccess: () => addToast('success', t('saved')),
      });
    }
  }

  function handleOgImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadOgImage.mutate(file, {
        onSuccess: () => addToast('success', t('saved')),
      });
    }
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  function imgSrc(url?: string | null) {
    if (!url) return '';
    return url.startsWith('http') ? url : `${apiBase}${url}`;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const inputClass =
    'mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* General Settings */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('general')}
            </h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('siteName')}</label>
              <input
                type="text"
                value={form.siteName}
                onChange={(e) => setForm((s) => ({ ...s, siteName: e.target.value }))}
                placeholder={t('siteNamePlaceholder')}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('description')}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                placeholder={t('descriptionPlaceholder')}
                rows={3}
                className={cn(inputClass, 'resize-none')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('keywords')}</label>
              <input
                type="text"
                value={form.keywords}
                onChange={(e) => setForm((s) => ({ ...s, keywords: e.target.value }))}
                placeholder={t('keywordsPlaceholder')}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('copyrightText')}</label>
              <input
                type="text"
                value={form.copyrightText}
                onChange={(e) => setForm((s) => ({ ...s, copyrightText: e.target.value }))}
                placeholder={t('copyrightTextPlaceholder')}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('timezone')}</label>
              <select
                value={form.timezone}
                onChange={(e) => setForm((s) => ({ ...s, timezone: e.target.value }))}
                className={inputClass}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('branding')}
            </h2>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('primaryColor')}</label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => setForm((s) => ({ ...s, primaryColor: e.target.value }))}
                    className="h-10 w-10 rounded border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.primaryColor}
                    onChange={(e) => setForm((s) => ({ ...s, primaryColor: e.target.value }))}
                    className="w-28 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">{t('secondaryColor')}</label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="color"
                    value={form.secondaryColor}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, secondaryColor: e.target.value }))
                    }
                    className="h-10 w-10 rounded border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.secondaryColor}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, secondaryColor: e.target.value }))
                    }
                    className="w-28 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            </div>

            {/* Logo */}
            <div>
              <label className="text-sm font-medium">{t('logo')}</label>
              <div className="mt-2 flex items-center gap-4">
                {settings?.logoUrl && (
                  <img
                    src={imgSrc(settings.logoUrl)}
                    alt="Logo"
                    className="h-16 w-16 rounded-lg object-contain border bg-white"
                  />
                )}
                <div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadLogo.isPending}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {uploadLogo.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {t('uploadLogo')}
                  </button>
                  <p className="text-xs text-muted-foreground mt-1">{t('maxFileSize')}</p>
                </div>
              </div>
            </div>

            {/* Favicon */}
            <div>
              <label className="text-sm font-medium">{t('favicon')}</label>
              <div className="mt-2 flex items-center gap-4">
                {settings?.faviconUrl && (
                  <img
                    src={imgSrc(settings.faviconUrl)}
                    alt="Favicon"
                    className="h-10 w-10 rounded object-contain border bg-white"
                  />
                )}
                <div>
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFaviconUpload}
                  />
                  <button
                    onClick={() => faviconInputRef.current?.click()}
                    disabled={uploadFavicon.isPending}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {uploadFavicon.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {t('uploadFavicon')}
                  </button>
                  <p className="text-xs text-muted-foreground mt-1">{t('maxFileSize')}</p>
                </div>
              </div>
            </div>

            {/* OG Image */}
            <div>
              <label className="text-sm font-medium">{t('ogImage')}</label>
              <p className="text-xs text-muted-foreground">{t('ogImageDesc')}</p>
              <div className="mt-2 flex items-center gap-4">
                {settings?.ogImageUrl && (
                  <img
                    src={imgSrc(settings.ogImageUrl)}
                    alt="OG Image"
                    className="h-16 w-28 rounded-lg object-cover border bg-white"
                  />
                )}
                <div>
                  <input
                    ref={ogImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleOgImageUpload}
                  />
                  <button
                    onClick={() => ogImageInputRef.current?.click()}
                    disabled={uploadOgImage.isPending}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {uploadOgImage.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileImage className="h-4 w-4" />
                    )}
                    {t('uploadOgImage')}
                  </button>
                  <p className="text-xs text-muted-foreground mt-1">{t('ogImageSize')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Share2 className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('social')}
            </h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('twitterUrl')}</label>
              <input
                type="url"
                value={form.twitterUrl}
                onChange={(e) => setForm((s) => ({ ...s, twitterUrl: e.target.value }))}
                placeholder="https://twitter.com/..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('facebookUrl')}</label>
              <input
                type="url"
                value={form.facebookUrl}
                onChange={(e) => setForm((s) => ({ ...s, facebookUrl: e.target.value }))}
                placeholder="https://facebook.com/..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('instagramUrl')}</label>
              <input
                type="url"
                value={form.instagramUrl}
                onChange={(e) => setForm((s) => ({ ...s, instagramUrl: e.target.value }))}
                placeholder="https://instagram.com/..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('youtubeUrl')}</label>
              <input
                type="url"
                value={form.youtubeUrl}
                onChange={(e) => setForm((s) => ({ ...s, youtubeUrl: e.target.value }))}
                placeholder="https://youtube.com/..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('linkedinUrl')}</label>
              <input
                type="url"
                value={form.linkedinUrl}
                onChange={(e) => setForm((s) => ({ ...s, linkedinUrl: e.target.value }))}
                placeholder="https://linkedin.com/..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('githubUrl')}</label>
              <input
                type="url"
                value={form.githubUrl}
                onChange={(e) => setForm((s) => ({ ...s, githubUrl: e.target.value }))}
                placeholder="https://github.com/..."
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t('contact')}
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('supportEmail')}</label>
                <input
                  type="email"
                  value={form.supportEmail}
                  onChange={(e) => setForm((s) => ({ ...s, supportEmail: e.target.value }))}
                  placeholder={t('supportEmailPlaceholder')}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('contactPhone')}</label>
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => setForm((s) => ({ ...s, contactPhone: e.target.value }))}
                  placeholder={t('contactPhonePlaceholder')}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('companyAddress')}</label>
                <textarea
                  value={form.companyAddress}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, companyAddress: e.target.value }))
                  }
                  placeholder={t('companyAddressPlaceholder')}
                  rows={2}
                  className={cn(inputClass, 'resize-none')}
                />
              </div>
            </div>
          </div>

          {/* Analytics & Tracking */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t('analytics')}
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('googleAnalyticsId')}</label>
                <input
                  type="text"
                  value={form.googleAnalyticsId}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, googleAnalyticsId: e.target.value }))
                  }
                  placeholder={t('googleAnalyticsIdPlaceholder')}
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('googleAnalyticsIdDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Head Scripts */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Code2 className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('customScripts')}
            </h2>
          </div>
          <div>
            <label className="text-sm font-medium">{t('customHeadScripts')}</label>
            <p className="text-xs text-muted-foreground mb-2">{t('customHeadScriptsDesc')}</p>
            <textarea
              value={form.customHeadScripts}
              onChange={(e) =>
                setForm((s) => ({ ...s, customHeadScripts: e.target.value }))
              }
              placeholder={t('customHeadScriptsPlaceholder')}
              rows={6}
              className={cn(inputClass, 'font-mono text-xs')}
            />
          </div>
        </div>

        {/* Maintenance */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('maintenance')}
            </h2>
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.maintenanceMode}
                onChange={(e) =>
                  setForm((s) => ({ ...s, maintenanceMode: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium">{t('maintenanceMode')}</span>
                <p className="text-xs text-muted-foreground">{t('maintenanceModeDesc')}</p>
              </div>
            </label>
            {form.maintenanceMode && (
              <div>
                <label className="text-sm font-medium">{t('maintenanceMessage')}</label>
                <textarea
                  value={form.maintenanceMessage}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, maintenanceMessage: e.target.value }))
                  }
                  placeholder={t('maintenanceMessagePlaceholder')}
                  rows={2}
                  className={cn(inputClass, 'resize-none')}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={updateSettings.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {updateSettings.isPending ? (
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

const TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Casablanca',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/New_York',
  'America/Sao_Paulo',
  'America/Toronto',
  'Asia/Baghdad',
  'Asia/Beirut',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Kuwait',
  'Asia/Riyadh',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Melbourne',
  'Australia/Sydney',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Europe/London',
  'Europe/Moscow',
  'Europe/Paris',
  'Pacific/Auckland',
];
