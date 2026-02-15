'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAdminSecuritySettings,
  useUpdateSecuritySettings,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Save,
  Shield,
  Clock,
  Lock,
  Smartphone,
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

export default function SecuritySettingsPage() {
  const t = useTranslations('admin.securitySettings');
  const tc = useTranslations('admin.common');
  const addToast = useToastStore((s) => s.addToast);

  const [form, setForm] = useState<Record<string, string>>({});
  const { data: configs, isLoading } = useAdminSecuritySettings();
  const updateSettings = useUpdateSecuritySettings();

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
        {/* Password Policy */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('passwordPolicy')}
            </h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('minPasswordLength')}</label>
              <input
                type="number"
                min={6}
                max={128}
                value={form.MIN_PASSWORD_LENGTH || ''}
                onChange={(e) => setField('MIN_PASSWORD_LENGTH', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('requireUppercase')}</p>
                <p className="text-xs text-muted-foreground">{t('requireUppercaseDesc')}</p>
              </div>
              <ToggleSwitch
                value={form.REQUIRE_UPPERCASE || 'false'}
                onChange={() => toggleField('REQUIRE_UPPERCASE')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('requireNumbers')}</p>
                <p className="text-xs text-muted-foreground">{t('requireNumbersDesc')}</p>
              </div>
              <ToggleSwitch
                value={form.REQUIRE_NUMBERS || 'false'}
                onChange={() => toggleField('REQUIRE_NUMBERS')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('requireSpecialChars')}</p>
                <p className="text-xs text-muted-foreground">{t('requireSpecialCharsDesc')}</p>
              </div>
              <ToggleSwitch
                value={form.REQUIRE_SPECIAL_CHARS || 'false'}
                onChange={() => toggleField('REQUIRE_SPECIAL_CHARS')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('passwordExpiryDays')}</label>
              <p className="text-xs text-muted-foreground mb-1">{t('passwordExpiryDaysDesc')}</p>
              <input
                type="number"
                min={0}
                value={form.PASSWORD_EXPIRY_DAYS || ''}
                onChange={(e) => setField('PASSWORD_EXPIRY_DAYS', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        </div>

        {/* Session Management */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('sessionManagement')}
            </h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('sessionTimeoutMinutes')}</label>
              <p className="text-xs text-muted-foreground mb-1">{t('sessionTimeoutMinutesDesc')}</p>
              <input
                type="number"
                min={1}
                value={form.SESSION_TIMEOUT_MINUTES || ''}
                onChange={(e) => setField('SESSION_TIMEOUT_MINUTES', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('maxSessionsPerUser')}</label>
              <p className="text-xs text-muted-foreground mb-1">{t('maxSessionsPerUserDesc')}</p>
              <input
                type="number"
                min={1}
                value={form.MAX_SESSIONS_PER_USER || ''}
                onChange={(e) => setField('MAX_SESSIONS_PER_USER', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        </div>

        {/* Login Protection */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('loginProtection')}
            </h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('maxLoginAttempts')}</label>
              <p className="text-xs text-muted-foreground mb-1">{t('maxLoginAttemptsDesc')}</p>
              <input
                type="number"
                min={1}
                value={form.MAX_LOGIN_ATTEMPTS || ''}
                onChange={(e) => setField('MAX_LOGIN_ATTEMPTS', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('lockoutDurationMinutes')}</label>
              <p className="text-xs text-muted-foreground mb-1">{t('lockoutDurationMinutesDesc')}</p>
              <input
                type="number"
                min={1}
                value={form.LOCKOUT_DURATION_MINUTES || ''}
                onChange={(e) => setField('LOCKOUT_DURATION_MINUTES', e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        </div>

        {/* Two-Factor Authentication */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('twoFactorAuth')}
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('enable2fa')}</p>
                <p className="text-xs text-muted-foreground">{t('enable2faDesc')}</p>
              </div>
              <ToggleSwitch
                value={form.ENABLE_2FA || 'false'}
                onChange={() => toggleField('ENABLE_2FA')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('enforce2faForAdmins')}</p>
                <p className="text-xs text-muted-foreground">{t('enforce2faForAdminsDesc')}</p>
              </div>
              <ToggleSwitch
                value={form.ENFORCE_2FA_FOR_ADMINS || 'false'}
                onChange={() => toggleField('ENFORCE_2FA_FOR_ADMINS')}
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
