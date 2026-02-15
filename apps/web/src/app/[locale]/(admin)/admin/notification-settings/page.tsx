'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAdminNotificationSettings,
  useUpdateNotificationSettings,
  useTestNotificationEmail,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Save,
  Mail,
  Bell,
  AlertTriangle,
  Send,
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

export default function NotificationSettingsPage() {
  const t = useTranslations('admin.notificationSettings');
  const tc = useTranslations('admin.common');
  const addToast = useToastStore((s) => s.addToast);

  const [form, setForm] = useState<Record<string, string>>({});
  const { data: configs, isLoading } = useAdminNotificationSettings();
  const updateSettings = useUpdateNotificationSettings();
  const testEmail = useTestNotificationEmail();

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

  function handleTestEmail() {
    testEmail.mutate(undefined, {
      onSuccess: () => addToast('success', t('testEmailSent')),
      onError: () => addToast('error', t('testEmailFailed')),
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={handleTestEmail}
          disabled={testEmail.isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 shrink-0"
        >
          {testEmail.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {t('sendTestEmail')}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Email Notifications */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('emailNotifications')}
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('enableEmailNotifications')}</p>
                <p className="text-xs text-muted-foreground">{t('enableEmailNotificationsDesc')}</p>
              </div>
              <ToggleSwitch
                value={form.ENABLE_EMAIL_NOTIFICATIONS || 'false'}
                onChange={() => toggleField('ENABLE_EMAIL_NOTIFICATIONS')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('adminAlertEmail')}</label>
              <p className="text-xs text-muted-foreground mb-1">{t('adminAlertEmailDesc')}</p>
              <input
                type="email"
                value={form.ADMIN_ALERT_EMAIL || ''}
                onChange={(e) => setField('ADMIN_ALERT_EMAIL', e.target.value)}
                placeholder="admin@example.com"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('dailySummaryEmail')}</p>
                <p className="text-xs text-muted-foreground">{t('dailySummaryEmailDesc')}</p>
              </div>
              <ToggleSwitch
                value={form.DAILY_SUMMARY_EMAIL || 'false'}
                onChange={() => toggleField('DAILY_SUMMARY_EMAIL')}
              />
            </div>
          </div>
        </div>

        {/* Event Triggers */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('eventTriggers')}
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('notifyNewUserSignup')}</p>
              </div>
              <ToggleSwitch
                value={form.NOTIFY_NEW_USER_SIGNUP || 'false'}
                onChange={() => toggleField('NOTIFY_NEW_USER_SIGNUP')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('notifyNewOrgCreated')}</p>
              </div>
              <ToggleSwitch
                value={form.NOTIFY_NEW_ORG_CREATED || 'false'}
                onChange={() => toggleField('NOTIFY_NEW_ORG_CREATED')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('notifyFailedPayment')}</p>
              </div>
              <ToggleSwitch
                value={form.NOTIFY_FAILED_PAYMENT || 'false'}
                onChange={() => toggleField('NOTIFY_FAILED_PAYMENT')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('notifySystemErrors')}</p>
              </div>
              <ToggleSwitch
                value={form.NOTIFY_SYSTEM_ERRORS || 'false'}
                onChange={() => toggleField('NOTIFY_SYSTEM_ERRORS')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('notifyNewContactMessage')}</p>
              </div>
              <ToggleSwitch
                value={form.NOTIFY_NEW_CONTACT_MESSAGE || 'false'}
                onChange={() => toggleField('NOTIFY_NEW_CONTACT_MESSAGE')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('notifyNewDemoRequest')}</p>
              </div>
              <ToggleSwitch
                value={form.NOTIFY_NEW_DEMO_REQUEST || 'false'}
                onChange={() => toggleField('NOTIFY_NEW_DEMO_REQUEST')}
              />
            </div>
          </div>
        </div>

        {/* Error Digest */}
        <div className="rounded-lg border bg-card p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('errorDigest')}
            </h2>
          </div>
          <div className="max-w-md">
            <label className="text-sm font-medium">{t('errorDigestIntervalHours')}</label>
            <p className="text-xs text-muted-foreground mb-1">{t('errorDigestIntervalHoursDesc')}</p>
            <input
              type="number"
              min={1}
              max={168}
              value={form.ERROR_DIGEST_INTERVAL_HOURS || ''}
              onChange={(e) => setField('ERROR_DIGEST_INTERVAL_HOURS', e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
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
