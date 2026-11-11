'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAdminSiteSettings, useUpdateSiteSettings } from '@/hooks/useAdmin';

/** Row returned by GET /admin/site-settings (prisma SiteSettings). */
export interface SiteSettings {
  id: string;
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  description: string;
  keywords: string;
  primaryColor: string;
  secondaryColor: string;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  supportEmail: string | null;
  contactPhone: string | null;
  companyAddress: string | null;
  copyrightText: string | null;
  timezone: string;
  googleAnalyticsId: string | null;
  customHeadScripts: string | null;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  supportChatEnabled: boolean;
  supportChatChannelId: string | null;
  supportChatPosition: string;
  supportChatColor: string;
  supportChatWelcome: string | null;
  supportChatWelcomeAr: string | null;
}

// Text fields the PATCH schema accepts. `nullable` fields are cleared with null
// (the API rejects "" for URL/email fields); the rest are plain strings.
const TEXT_FIELDS = {
  siteName: { nullable: false },
  description: { nullable: false },
  keywords: { nullable: false },
  primaryColor: { nullable: false },
  secondaryColor: { nullable: false },
  timezone: { nullable: false },
  supportChatPosition: { nullable: false },
  supportChatColor: { nullable: false },
  twitterUrl: { nullable: true },
  linkedinUrl: { nullable: true },
  githubUrl: { nullable: true },
  facebookUrl: { nullable: true },
  instagramUrl: { nullable: true },
  youtubeUrl: { nullable: true },
  supportEmail: { nullable: true },
  contactPhone: { nullable: true },
  companyAddress: { nullable: true },
  copyrightText: { nullable: true },
  googleAnalyticsId: { nullable: true },
  customHeadScripts: { nullable: true },
  maintenanceMessage: { nullable: true },
  supportChatChannelId: { nullable: true },
  supportChatWelcome: { nullable: true },
  supportChatWelcomeAr: { nullable: true },
} as const;

const BOOLEAN_FIELDS = ['maintenanceMode', 'supportChatEnabled'] as const;

export type SiteTextField = keyof typeof TEXT_FIELDS;
export type SiteBooleanField = (typeof BOOLEAN_FIELDS)[number];
export type SiteField = SiteTextField | SiteBooleanField;

/** Which client-side rule a field failed; the tabs translate it. */
export type SiteFieldError = 'required' | 'url' | 'email' | 'color' | 'invalid';

const URL_FIELDS: SiteTextField[] = [
  'twitterUrl',
  'linkedinUrl',
  'githubUrl',
  'facebookUrl',
  'instagramUrl',
  'youtubeUrl',
];
const COLOR_FIELDS: SiteTextField[] = ['primaryColor', 'secondaryColor', 'supportChatColor'];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function serverText(settings: SiteSettings | undefined, field: SiteTextField): string {
  return settings?.[field] ?? '';
}

type Overrides = Partial<Record<SiteField, string | boolean>>;

export interface SaveResult {
  ok: boolean;
  /**
   * Why the save did not go through: `validation` (client or server field validation),
   * `channel` (the API rejected the support chat Integration ID) or `error` (anything else).
   */
  reason?: 'validation' | 'channel' | 'error';
  /** Fields that were marked invalid, so the page can jump to the tab that holds them. */
  fields?: SiteField[];
}

/**
 * Edits to site settings are kept as overrides on top of the server row rather than as
 * a full copy, so a refetch (e.g. after uploading a logo) never discards unsaved edits.
 */
export function useSiteSettingsForm() {
  const query = useAdminSiteSettings();
  const update = useUpdateSiteSettings();
  const settings = query.data as SiteSettings | undefined;

  const [overrides, setOverrides] = useState<Overrides>({});
  const [errors, setErrors] = useState<Partial<Record<SiteField, SiteFieldError>>>({});

  const text = useCallback(
    (field: SiteTextField): string => {
      const override = overrides[field];
      return typeof override === 'string' ? override : serverText(settings, field);
    },
    [overrides, settings],
  );

  const bool = useCallback(
    (field: SiteBooleanField): boolean => {
      const override = overrides[field];
      return typeof override === 'boolean' ? override : Boolean(settings?.[field]);
    },
    [overrides, settings],
  );

  const setText = useCallback((field: SiteTextField, value: string) => {
    setOverrides((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }, []);

  const setBool = useCallback((field: SiteBooleanField, value: boolean) => {
    setOverrides((prev) => ({ ...prev, [field]: value }));
  }, []);

  /** Fields whose edited value differs from what the server has, in API payload form. */
  const changes = useMemo(() => {
    const payload: Record<string, string | boolean | null> = {};
    if (!settings) return payload;
    for (const field of Object.keys(TEXT_FIELDS) as SiteTextField[]) {
      const override = overrides[field];
      if (typeof override !== 'string') continue;
      const next = TEXT_FIELDS[field].nullable ? override.trim() : override;
      if (next === serverText(settings, field)) continue;
      payload[field] = TEXT_FIELDS[field].nullable && next === '' ? null : next;
    }
    for (const field of BOOLEAN_FIELDS) {
      const override = overrides[field];
      if (typeof override === 'boolean' && override !== settings[field]) payload[field] = override;
    }
    return payload;
  }, [overrides, settings]);

  const dirty = Object.keys(changes).length > 0;

  const validate = useCallback((): SiteField[] => {
    const next: Partial<Record<SiteField, SiteFieldError>> = {};
    const changed = (field: SiteTextField) => field in changes;

    if (changed('siteName') && text('siteName').trim() === '') next.siteName = 'required';
    for (const field of COLOR_FIELDS) {
      if (changed(field) && !HEX_COLOR.test(text(field))) next[field] = 'color';
    }
    for (const field of URL_FIELDS) {
      const value = text(field).trim();
      if (changed(field) && value !== '' && !isHttpUrl(value)) next[field] = 'url';
    }
    const email = text('supportEmail').trim();
    if (changed('supportEmail') && email !== '' && !EMAIL.test(email)) next.supportEmail = 'email';

    setErrors(next);
    return Object.keys(next) as SiteField[];
  }, [changes, text]);

  const discard = useCallback(() => {
    setOverrides({});
    setErrors({});
  }, []);

  const save = useCallback(async (): Promise<SaveResult> => {
    const invalid = validate();
    if (invalid.length > 0) return { ok: false, reason: 'validation', fields: invalid };
    try {
      await update.mutateAsync(changes);
      setOverrides({});
      setErrors({});
      return { ok: true };
    } catch (err) {
      const response = (
        err as {
          response?: {
            status?: number;
            data?: {
              code?: string;
              details?: { body?: { fieldErrors?: Record<string, string[]> } };
            };
          };
        }
      ).response;
      const fieldErrors = response?.data?.details?.body?.fieldErrors;
      if (response?.data?.code === 'VALIDATION_ERROR' && fieldErrors) {
        const next: Partial<Record<SiteField, SiteFieldError>> = {};
        for (const field of Object.keys(fieldErrors)) next[field as SiteField] = 'invalid';
        setErrors(next);
        return { ok: false, reason: 'validation', fields: Object.keys(next) as SiteField[] };
      }
      // The only other 400 this endpoint returns is the support chat channel check.
      if (response?.status === 400 && 'supportChatChannelId' in changes) {
        setErrors({ supportChatChannelId: 'invalid' });
        return { ok: false, reason: 'channel', fields: ['supportChatChannelId'] };
      }
      return { ok: false, reason: 'error' };
    }
  }, [changes, update, validate]);

  return {
    query,
    settings,
    text,
    bool,
    setText,
    setBool,
    errors,
    dirty,
    saving: update.isPending,
    save,
    discard,
  };
}

export type SiteSettingsForm = ReturnType<typeof useSiteSettingsForm>;
