'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAdminOrgDefaults,
  useUpdateOrgDefaults,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Save,
  CreditCard,
  Gauge,
  Settings,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

function ToggleSwitch({
  value,
  onChange,
  disabled,
}: {
  value: string;
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
        value === 'true' ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          value === 'true' ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAN_OPTIONS = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

const TIMEZONE_OPTIONS = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Africa/Cairo',
  'Africa/Johannesburg',
];

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 animate-pulse">
      <div className="h-4 w-32 rounded bg-muted mb-6" />
      <div className="space-y-4">
        <div className="h-8 w-full rounded bg-muted" />
        <div className="h-8 w-full rounded bg-muted" />
        <div className="h-8 w-3/4 rounded bg-muted" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OrgDefaultsPage() {
  const t = useTranslations('admin.orgDefaults');
  const tc = useTranslations('admin.common');
  const addToast = useToastStore((s) => s.addToast);

  const [form, setForm] = useState<Record<string, string>>({});
  const { data: configs, isLoading } = useAdminOrgDefaults();
  const updateSettings = useUpdateOrgDefaults();

  useEffect(() => {
    if (configs) {
      const map: Record<string, string> = {};
      for (const c of configs) {
        map[c.key] = c.value;
      }
      setForm(map);
    }
  }, [configs]);

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleField(key: string) {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key] === 'true' ? 'false' : 'true',
    }));
  }

  function handleSave() {
    updateSettings.mutate(form, {
      onSuccess: () => addToast('success', t('saved')),
      onError: () => addToast('error', tc('error')),
    });
  }

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <div className="h-7 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-72 rounded bg-muted animate-pulse mt-2" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Plan & Trial */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('planAndTrial')}
            </h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('defaultPlan')}</label>
              <p className="text-xs text-muted-foreground mb-1">{t('defaultPlanDesc')}</p>
              <select
                value={form.DEFAULT_PLAN || 'FREE'}
                onChange={(e) => setField('DEFAULT_PLAN', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              >
                {PLAN_OPTIONS.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">{t('trialPeriodDays')}</label>
              <p className="text-xs text-muted-foreground mb-1">{t('trialPeriodDaysDesc')}</p>
              <input
                type="number"
                min={0}
                max={365}
                value={form.TRIAL_PERIOD_DAYS || ''}
                onChange={(e) => setField('TRIAL_PERIOD_DAYS', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        </div>

        {/* Limits Info */}
        <div className="rounded-lg border bg-muted/30 p-6 shadow-sm flex items-start gap-3">
          <Gauge className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold">
              {t('defaultLimits')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('limitsDefinedInPlans')}
            </p>
          </div>
        </div>

        {/* Provisioning */}
        <div className="rounded-lg border bg-card p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('provisioning')}
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium">{t('defaultTimezone')}</label>
              <p className="text-xs text-muted-foreground mb-1">{t('defaultTimezoneDesc')}</p>
              <select
                value={form.DEFAULT_TIMEZONE || 'UTC'}
                onChange={(e) => setField('DEFAULT_TIMEZONE', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between sm:flex-col sm:items-start sm:justify-start sm:gap-2">
              <div>
                <p className="text-sm font-medium">{t('autoCreateWebchatChannel')}</p>
                <p className="text-xs text-muted-foreground">{t('autoCreateWebchatChannelDesc')}</p>
              </div>
              <ToggleSwitch
                value={form.AUTO_CREATE_WEBCHAT_CHANNEL || 'false'}
                onChange={() => toggleField('AUTO_CREATE_WEBCHAT_CHANNEL')}
              />
            </div>
            <div className="flex items-center justify-between sm:flex-col sm:items-start sm:justify-start sm:gap-2">
              <div>
                <p className="text-sm font-medium">{t('requireEmailVerification')}</p>
                <p className="text-xs text-muted-foreground">{t('requireEmailVerificationDesc')}</p>
              </div>
              <ToggleSwitch
                value={form.REQUIRE_EMAIL_VERIFICATION || 'false'}
                onChange={() => toggleField('REQUIRE_EMAIL_VERIFICATION')}
              />
            </div>
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
          {t('saveAll')}
        </button>
      </div>
    </div>
  );
}
