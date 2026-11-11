'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { UseMutationResult } from '@tanstack/react-query';
import {
  BarChart3,
  Code2,
  Globe,
  ImageIcon,
  Loader2,
  Mail,
  MessageCircle,
  Palette,
  Share2,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/hooks/useToast';
import {
  useUpdateSiteSettings,
  useUploadSiteFavicon,
  useUploadSiteLogo,
  useUploadSiteOgImage,
} from '@/hooks/useAdmin';
import {
  ColorField,
  SelectField,
  SettingsCard,
  TextAreaField,
  TextField,
  ToggleRow,
} from './fields';
import type { SiteField, SiteSettingsForm } from './useSiteSettingsForm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/**
 * Uploaded assets are stored as API paths ("/api/v1/files/logo-123.png"). Resolve them
 * against the API origin so the preview also works when web and API run on different
 * ports (local dev); absolute URLs are returned untouched.
 */
function resolveAssetUrl(url: string): string {
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url;
  try {
    return new URL(url, API_BASE_URL).toString();
  } catch {
    return url; // relative API base: same origin as the web app
  }
}

const FALLBACK_TIMEZONES = [
  'UTC',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Asia/Bahrain',
  'Africa/Cairo',
  'Asia/Amman',
  'Asia/Beirut',
  'Asia/Baghdad',
  'Africa/Casablanca',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
];

function listTimezones(current: string): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  let zones: string[] = FALLBACK_TIMEZONES;
  try {
    const supported = intl.supportedValuesOf?.('timeZone');
    if (supported && supported.length > 0) zones = supported;
  } catch {
    // keep the fallback list
  }
  return Array.from(new Set(['UTC', ...zones, ...(current ? [current] : [])]));
}

/** Translates the validation error (if any) for a site settings field. */
function useFieldError(form: SiteSettingsForm) {
  const t = useTranslations('admin.settings');
  return (field: SiteField): string | undefined => {
    const error = form.errors[field];
    if (!error) return undefined;
    if (field === 'supportChatChannelId') return t('supportChat.invalidIntegrationId');
    return t(`validation.${error}`);
  };
}

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // matches multer limit in siteSettings.routes.ts
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const ICON_TYPES = [...IMAGE_TYPES, 'image/x-icon', 'image/vnd.microsoft.icon'];

// ---------------------------------------------------------------------------
// Asset uploader (logo / favicon / OG image)
// ---------------------------------------------------------------------------

function AssetUploader({
  label,
  hint,
  uploadLabel,
  url,
  field,
  accept,
  upload,
  previewClassName,
  testId,
}: {
  label: string;
  hint: string;
  uploadLabel: string;
  url: string | null | undefined;
  field: 'logoUrl' | 'faviconUrl' | 'ogImageUrl';
  accept: string[];
  upload: Pick<UseMutationResult<unknown, Error, File>, 'mutate' | 'isPending'>;
  previewClassName: string;
  testId: string;
}) {
  const t = useTranslations('admin.settings');
  const addToast = useToastStore((s) => s.addToast);
  const inputRef = useRef<HTMLInputElement>(null);
  const remove = useUpdateSiteSettings();
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);

  const busy = upload.isPending || remove.isPending;
  const showImage = Boolean(url) && brokenUrl !== url;

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!accept.includes(file.type)) {
      addToast('error', t('upload.invalidType'));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      addToast('error', t('upload.tooLarge'));
      return;
    }
    upload.mutate(file, {
      onSuccess: () => addToast('success', t('upload.uploaded')),
      onError: () => addToast('error', t('upload.failed')),
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40',
          previewClassName,
        )}
      >
        {showImage && url ? (
          <img
            src={resolveAssetUrl(url)}
            alt={label}
            data-testid={`${testId}-preview`}
            className="h-full w-full object-contain"
            onError={() => setBrokenUrl(url)}
          />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{url ? hint : t('upload.empty')}</p>
        {!url && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={accept.join(',')}
            className="hidden"
            data-testid={`${testId}-input`}
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {upload.isPending ? t('upload.uploading') : uploadLabel}
          </button>
          {url && (
            <button
              type="button"
              disabled={busy}
              data-testid={`${testId}-remove`}
              onClick={() =>
                remove.mutate(
                  { [field]: null },
                  {
                    onSuccess: () => addToast('success', t('upload.removed')),
                    onError: () => addToast('error', t('failedSave')),
                  },
                )
              }
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {t('upload.remove')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------

export function GeneralTab({ form }: { form: SiteSettingsForm }) {
  const ts = useTranslations('admin.siteSettings');
  const fieldError = useFieldError(form);
  const timezone = form.text('timezone');
  const timezones = useMemo(() => listTimezones(timezone), [timezone]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <SettingsCard title={ts('general')} icon={Globe} className="xl:col-span-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            name="siteName"
            label={ts('siteName')}
            value={form.text('siteName')}
            onChange={(v) => form.setText('siteName', v)}
            placeholder={ts('siteNamePlaceholder')}
            maxLength={100}
            error={fieldError('siteName')}
          />
          <SelectField
            name="timezone"
            label={ts('timezone')}
            value={timezone}
            onChange={(v) => form.setText('timezone', v)}
            options={timezones.map((zone) => ({ value: zone, label: zone }))}
            ltr
          />
        </div>
        <TextAreaField
          name="description"
          label={ts('description')}
          value={form.text('description')}
          onChange={(v) => form.setText('description', v)}
          placeholder={ts('descriptionPlaceholder')}
          maxLength={500}
          rows={2}
          error={fieldError('description')}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            name="keywords"
            label={ts('keywords')}
            value={form.text('keywords')}
            onChange={(v) => form.setText('keywords', v)}
            placeholder={ts('keywordsPlaceholder')}
            maxLength={500}
            error={fieldError('keywords')}
          />
          <TextField
            name="copyrightText"
            label={ts('copyrightText')}
            value={form.text('copyrightText')}
            onChange={(v) => form.setText('copyrightText', v)}
            placeholder={ts('copyrightTextPlaceholder')}
            maxLength={200}
            error={fieldError('copyrightText')}
          />
        </div>
      </SettingsCard>

      <SettingsCard title={ts('contact')} icon={Mail}>
        <TextField
          name="supportEmail"
          type="email"
          label={ts('supportEmail')}
          value={form.text('supportEmail')}
          onChange={(v) => form.setText('supportEmail', v)}
          placeholder={ts('supportEmailPlaceholder')}
          error={fieldError('supportEmail')}
          ltr
        />
        <TextField
          name="contactPhone"
          type="tel"
          label={ts('contactPhone')}
          value={form.text('contactPhone')}
          onChange={(v) => form.setText('contactPhone', v)}
          placeholder={ts('contactPhonePlaceholder')}
          maxLength={30}
          error={fieldError('contactPhone')}
          ltr
        />
        <TextAreaField
          name="companyAddress"
          label={ts('companyAddress')}
          value={form.text('companyAddress')}
          onChange={(v) => form.setText('companyAddress', v)}
          placeholder={ts('companyAddressPlaceholder')}
          maxLength={500}
          rows={2}
          error={fieldError('companyAddress')}
        />
      </SettingsCard>

      <SettingsCard title={ts('social')} icon={Share2}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(
            [
              ['twitterUrl', 'https://x.com/…'],
              ['facebookUrl', 'https://facebook.com/…'],
              ['instagramUrl', 'https://instagram.com/…'],
              ['youtubeUrl', 'https://youtube.com/…'],
              ['linkedinUrl', 'https://linkedin.com/company/…'],
              ['githubUrl', 'https://github.com/…'],
            ] as const
          ).map(([field, placeholder]) => (
            <TextField
              key={field}
              name={field}
              type="url"
              label={ts(field)}
              value={form.text(field)}
              onChange={(v) => form.setText(field, v)}
              placeholder={placeholder}
              error={fieldError(field)}
              ltr
            />
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------

export function AppearanceTab({ form }: { form: SiteSettingsForm }) {
  const t = useTranslations('admin.settings');
  const ts = useTranslations('admin.siteSettings');
  const fieldError = useFieldError(form);
  const uploadLogo = useUploadSiteLogo();
  const uploadFavicon = useUploadSiteFavicon();

  const primary = form.text('primaryColor');
  const secondary = form.text('secondaryColor');

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <SettingsCard title={ts('branding')} icon={ImageIcon}>
        <AssetUploader
          testId="logo"
          field="logoUrl"
          label={ts('logo')}
          hint={ts('maxFileSize')}
          uploadLabel={ts('uploadLogo')}
          url={form.settings?.logoUrl}
          accept={IMAGE_TYPES}
          upload={uploadLogo}
          previewClassName="h-20 w-20"
        />
        <div className="border-t pt-4">
          <AssetUploader
            testId="favicon"
            field="faviconUrl"
            label={ts('favicon')}
            hint={ts('maxFileSize')}
            uploadLabel={ts('uploadFavicon')}
            url={form.settings?.faviconUrl}
            accept={ICON_TYPES}
            upload={uploadFavicon}
            previewClassName="h-12 w-12"
          />
        </div>
      </SettingsCard>

      <SettingsCard title={t('colors')} icon={Palette}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorField
            name="primaryColor"
            label={ts('primaryColor')}
            value={primary}
            onChange={(v) => form.setText('primaryColor', v)}
            error={fieldError('primaryColor')}
          />
          <ColorField
            name="secondaryColor"
            label={ts('secondaryColor')}
            value={secondary}
            onChange={(v) => form.setText('secondaryColor', v)}
            error={fieldError('secondaryColor')}
          />
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('livePreview')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: primary }}
            >
              {t('primaryButton')}
            </span>
            <span
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: secondary }}
            >
              {t('secondaryButton')}
            </span>
            <span
              className="h-9 flex-1 rounded-lg"
              style={{ backgroundImage: `linear-gradient(90deg, ${primary}, ${secondary})` }}
            />
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content & SEO
// ---------------------------------------------------------------------------

export function ContentSeoTab({ form }: { form: SiteSettingsForm }) {
  const ts = useTranslations('admin.siteSettings');
  const fieldError = useFieldError(form);
  const uploadOgImage = useUploadSiteOgImage();
  const maintenanceOn = form.bool('maintenanceMode');

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <SettingsCard title={ts('ogImage')} description={ts('ogImageDesc')} icon={Share2}>
        <AssetUploader
          testId="og-image"
          field="ogImageUrl"
          label={ts('ogImage')}
          hint={ts('ogImageSize')}
          uploadLabel={ts('uploadOgImage')}
          url={form.settings?.ogImageUrl}
          accept={IMAGE_TYPES}
          upload={uploadOgImage}
          previewClassName="h-[84px] w-40"
        />
      </SettingsCard>

      <SettingsCard title={ts('analytics')} icon={BarChart3}>
        <TextField
          name="googleAnalyticsId"
          label={ts('googleAnalyticsId')}
          value={form.text('googleAnalyticsId')}
          onChange={(v) => form.setText('googleAnalyticsId', v)}
          placeholder={ts('googleAnalyticsIdPlaceholder')}
          hint={ts('googleAnalyticsIdDesc')}
          maxLength={30}
          error={fieldError('googleAnalyticsId')}
          ltr
        />
      </SettingsCard>

      <SettingsCard title={ts('customScripts')} icon={Code2}>
        <TextAreaField
          name="customHeadScripts"
          label={ts('customHeadScripts')}
          value={form.text('customHeadScripts')}
          onChange={(v) => form.setText('customHeadScripts', v)}
          // These two messages contain literal <script>/<head> markup, which the ICU
          // parser would treat as rich-text tags — read them unformatted.
          placeholder={ts.raw('customHeadScriptsPlaceholder') as string}
          hint={ts.raw('customHeadScriptsDesc') as string}
          maxLength={5000}
          rows={6}
          error={fieldError('customHeadScripts')}
          ltr
          mono
        />
      </SettingsCard>

      <SettingsCard
        title={ts('maintenance')}
        icon={Wrench}
        className={cn(maintenanceOn && 'border-amber-300 dark:border-amber-700')}
      >
        <ToggleRow
          name="maintenanceMode"
          label={ts('maintenanceMode')}
          description={ts('maintenanceModeDesc')}
          checked={maintenanceOn}
          onChange={(v) => form.setBool('maintenanceMode', v)}
        />
        <TextAreaField
          name="maintenanceMessage"
          label={ts('maintenanceMessage')}
          value={form.text('maintenanceMessage')}
          onChange={(v) => form.setText('maintenanceMessage', v)}
          placeholder={ts('maintenanceMessagePlaceholder')}
          maxLength={500}
          rows={3}
          error={fieldError('maintenanceMessage')}
        />
      </SettingsCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Support chat
// ---------------------------------------------------------------------------

export function SupportChatTab({ form }: { form: SiteSettingsForm }) {
  const t = useTranslations('admin.settings');
  const fieldError = useFieldError(form);
  const enabled = form.bool('supportChatEnabled');

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <SettingsCard title={t('tabs.supportChat')} icon={MessageCircle}>
        <ToggleRow
          name="supportChatEnabled"
          label={t('supportChat.enableLabel')}
          description={t('supportChat.enableDescription')}
          checked={enabled}
          onChange={(v) => form.setBool('supportChatEnabled', v)}
        />
        <TextField
          name="supportChatChannelId"
          label={t('supportChat.integrationId')}
          value={form.text('supportChatChannelId')}
          onChange={(v) => form.setText('supportChatChannelId', v)}
          placeholder={t('supportChat.integrationIdPlaceholder')}
          hint={t('supportChat.integrationIdHelp')}
          maxLength={100}
          error={fieldError('supportChatChannelId')}
          ltr
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            name="supportChatPosition"
            label={t('supportChat.position')}
            value={form.text('supportChatPosition')}
            onChange={(v) => form.setText('supportChatPosition', v)}
            options={[
              { value: 'right', label: t('supportChat.positionRight') },
              { value: 'left', label: t('supportChat.positionLeft') },
            ]}
          />
          <ColorField
            name="supportChatColor"
            label={t('supportChat.widgetColor')}
            value={form.text('supportChatColor')}
            onChange={(v) => form.setText('supportChatColor', v)}
            error={fieldError('supportChatColor')}
          />
        </div>
      </SettingsCard>

      <SettingsCard title={t('supportChat.welcomeTitle')} icon={MessageCircle}>
        <TextAreaField
          name="supportChatWelcome"
          label={t('supportChat.welcomeEn')}
          value={form.text('supportChatWelcome')}
          onChange={(v) => form.setText('supportChatWelcome', v)}
          placeholder={t('supportChat.welcomeEnPlaceholder')}
          maxLength={500}
          rows={3}
          error={fieldError('supportChatWelcome')}
          ltr
        />
        <TextAreaField
          name="supportChatWelcomeAr"
          label={t('supportChat.welcomeAr')}
          value={form.text('supportChatWelcomeAr')}
          onChange={(v) => form.setText('supportChatWelcomeAr', v)}
          placeholder={t('supportChat.welcomeArPlaceholder')}
          maxLength={500}
          rows={3}
          error={fieldError('supportChatWelcomeAr')}
          rtl
        />
      </SettingsCard>
    </div>
  );
}
