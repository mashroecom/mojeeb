'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Section } from './SectionWrapper';
import { Building2, Save, Loader2, CheckCircle } from 'lucide-react';

const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

const selectClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

const TIMEZONE_OPTIONS = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Bahrain',
  'Asia/Qatar',
  'Africa/Cairo',
  'Asia/Baghdad',
  'Asia/Amman',
  'Asia/Beirut',
  'Asia/Damascus',
  'Africa/Casablanca',
  'Africa/Tunis',
  'Africa/Algiers',
  'Africa/Tripoli',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Pacific/Auckland',
  'UTC',
];

interface OrganizationSectionProps {
  isLoading: boolean;
  orgName: string;
  setOrgName: (v: string) => void;
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  defaultLanguage: string;
  setDefaultLanguage: (v: string) => void;
  handleSave: (e: React.FormEvent) => void;
  updateOrgIsPending: boolean;
  showSaved: boolean;
}

export function OrganizationSection({
  isLoading,
  orgName,
  setOrgName,
  websiteUrl,
  setWebsiteUrl,
  timezone,
  setTimezone,
  defaultLanguage,
  setDefaultLanguage,
  handleSave,
  updateOrgIsPending,
  showSaved,
}: OrganizationSectionProps) {
  const t = useTranslations('dashboard.settings');

  return (
    <Section icon={Building2} title={t('orgSettings')}>
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label
              htmlFor="orgName"
              className="block text-sm font-medium mb-1.5"
            >
              {t('orgName')}
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder={t('orgNamePlaceholder')}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="websiteUrl"
              className="block text-sm font-medium mb-1.5"
            >
              {t('website')}
            </label>
            <input
              id="websiteUrl"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              className={inputClass}
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="timezone"
                className="block text-sm font-medium mb-1.5"
              >
                {t('timezone')}
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className={selectClass}
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="defaultLanguage"
                className="block text-sm font-medium mb-1.5"
              >
                {t('defaultLanguage')}
              </label>
              <select
                id="defaultLanguage"
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                className={selectClass}
              >
                <option value="ar">{t('languageAr')}</option>
                <option value="en">{t('languageEn')}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={updateOrgIsPending || !orgName.trim()}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                (updateOrgIsPending || !orgName.trim()) &&
                  'cursor-not-allowed opacity-50',
              )}
            >
              {updateOrgIsPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t('saveChanges')}
            </button>
            {showSaved && (
              <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                {t('saved')}
              </span>
            )}
          </div>
        </form>
      )}
    </Section>
  );
}
