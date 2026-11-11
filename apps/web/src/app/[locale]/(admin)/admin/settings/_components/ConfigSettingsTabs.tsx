'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import {
  AlertOctagon,
  Building2,
  Gauge,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Rocket,
  Send,
  ShieldCheck,
  Timer,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useToastStore } from '@/hooks/useToast';
import {
  useAdminNotificationSettings,
  useAdminOrgDefaults,
  useAdminSecuritySettings,
  useTestNotificationEmail,
  useUpdateNotificationSettings,
  useUpdateOrgDefaults,
  useUpdateSecuritySettings,
} from '@/hooks/useAdmin';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  NotEnforcedNote,
  SaveBar,
  SelectField,
  SettingsCard,
  TextField,
  ToggleRow,
} from './fields';

/**
 * Security / notification / organization-default settings are all stored as
 * SystemConfig rows ({ key, value: string }) and saved in bulk with
 * PATCH { settings: { KEY: "value" } }. This file renders them from a declarative
 * field list; only keys listed here are shown, because the API ignores any other key.
 *
 * Each row carries `enforced`: whether the backend actually acts on the setting. Settings
 * that are stored but not acted on are rendered disabled with a "Not enforced yet" note
 * (`notEnforced` gives the reason) instead of looking like working controls.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfigRow {
  key: string;
  value: string;
  /** False when no backend code acts on this setting. Absent on older API versions. */
  enforced?: boolean;
}

/** Shared by every field: an optional hint and the reason shown when it is not enforced. */
interface FieldBase {
  key: string;
  label: string;
  hint?: string;
  notEnforced?: string;
}

type FieldDef = FieldBase &
  (
    | { type: 'boolean' }
    | { type: 'number'; min: number; max: number }
    | { type: 'email'; placeholder?: string }
    | { type: 'select'; options: { value: string; label: string }[]; ltr?: boolean }
  );

interface SectionDef {
  title: string;
  description?: string;
  icon: LucideIcon;
  fields: FieldDef[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Generic form
// ---------------------------------------------------------------------------

function ConfigSettingsForm({
  query,
  mutation,
  sections,
  saveLabel,
  savedMessage,
  renderExtraActions,
}: {
  query: UseQueryResult<ConfigRow[] | undefined>;
  mutation: UseMutationResult<unknown, Error, Record<string, string>>;
  sections: SectionDef[];
  saveLabel: string;
  savedMessage: string;
  /** Extra save-bar actions; receives the saved (server) values and whether there are unsaved edits. */
  renderExtraActions?: (saved: Record<string, string>, dirty: boolean) => ReactNode;
}) {
  const t = useTranslations('admin.settings');
  const tc = useTranslations('admin.common');
  const addToast = useToastStore((s) => s.addToast);

  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const saved = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of query.data ?? []) map[row.key] = row.value;
    return map;
  }, [query.data]);

  const unenforced = useMemo(() => {
    const keys = new Set<string>();
    for (const row of query.data ?? []) if (row.enforced === false) keys.add(row.key);
    return keys;
  }, [query.data]);

  /** Hint for a field: the "not enforced" note when the backend ignores it, else its hint. */
  const hintFor = (field: FieldDef): ReactNode =>
    unenforced.has(field.key) ? (
      <NotEnforcedNote
        badge={t('notEnforcedBadge')}
        reason={field.notEnforced ?? t('notEnforcedGeneric')}
      />
    ) : (
      field.hint
    );

  const value = (key: string) => overrides[key] ?? saved[key] ?? '';
  const setValue = (key: string, next: string) => {
    setOverrides((prev) => ({ ...prev, [key]: next }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const rest = { ...prev };
      delete rest[key];
      return rest;
    });
  };

  const changes = useMemo(() => {
    const diff: Record<string, string> = {};
    for (const [key, next] of Object.entries(overrides)) {
      if (key in saved && next.trim() !== saved[key]) diff[key] = next.trim();
    }
    return diff;
  }, [overrides, saved]);
  const dirty = Object.keys(changes).length > 0;

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const field of sections.flatMap((s) => s.fields)) {
      if (!(field.key in changes)) continue;
      const raw = changes[field.key] ?? '';
      if (field.type === 'number') {
        const n = Number(raw);
        if (!/^\d+$/.test(raw) || n < field.min || n > field.max) {
          next[field.key] = t('validation.number', { min: field.min, max: field.max });
        }
      } else if (field.type === 'email' && raw !== '' && !EMAIL.test(raw)) {
        next[field.key] = t('validation.email');
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) {
      addToast('error', t('fixErrors'));
      return;
    }
    mutation.mutate(changes, {
      onSuccess: () => {
        setOverrides({});
        addToast('success', savedMessage);
      },
      onError: () => addToast('error', t('failedSave')),
    });
  }

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-5 shadow-sm animate-pulse">
            <div className="mb-5 h-5 w-40 rounded bg-muted" />
            <div className="space-y-4">
              <div className="h-10 rounded-lg bg-muted" />
              <div className="h-10 rounded-lg bg-muted" />
              <div className="h-10 rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-xl border bg-card shadow-sm">
        <ErrorState title={tc('error')} retryLabel={tc('retry')} onRetry={() => query.refetch()} />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {sections.map((section) => {
          // Only render keys the API actually returned.
          const fields = section.fields.filter((field) => field.key in saved);
          if (fields.length === 0) return null;
          const toggles = fields.filter((f) => f.type === 'boolean');
          const inputs = fields.filter((f) => f.type !== 'boolean');
          return (
            <SettingsCard
              key={section.title}
              title={section.title}
              description={section.description}
              icon={section.icon}
            >
              {inputs.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {inputs.map((field) => {
                    if (field.type === 'select') {
                      const current = value(field.key);
                      const options = field.options.some((o) => o.value === current)
                        ? field.options
                        : [...field.options, { value: current, label: current }];
                      return (
                        <SelectField
                          key={field.key}
                          name={field.key}
                          label={field.label}
                          hint={hintFor(field)}
                          disabled={unenforced.has(field.key)}
                          value={current}
                          onChange={(v) => setValue(field.key, v)}
                          options={options}
                          ltr={field.ltr}
                        />
                      );
                    }
                    if (field.type === 'number') {
                      return (
                        <TextField
                          key={field.key}
                          name={field.key}
                          type="number"
                          label={field.label}
                          hint={hintFor(field)}
                          disabled={unenforced.has(field.key)}
                          value={value(field.key)}
                          onChange={(v) => setValue(field.key, v)}
                          min={field.min}
                          max={field.max}
                          error={errors[field.key]}
                        />
                      );
                    }
                    return (
                      <TextField
                        key={field.key}
                        name={field.key}
                        type="email"
                        label={field.label}
                        hint={hintFor(field)}
                        disabled={unenforced.has(field.key)}
                        placeholder={field.type === 'email' ? field.placeholder : undefined}
                        value={value(field.key)}
                        onChange={(v) => setValue(field.key, v)}
                        error={errors[field.key]}
                        ltr
                      />
                    );
                  })}
                </div>
              )}
              {toggles.map((field) => (
                <ToggleRow
                  key={field.key}
                  name={field.key}
                  label={field.label}
                  description={hintFor(field)}
                  disabled={unenforced.has(field.key)}
                  checked={value(field.key) === 'true'}
                  onChange={(checked) => setValue(field.key, checked ? 'true' : 'false')}
                />
              ))}
            </SettingsCard>
          );
        })}
      </div>

      <SaveBar
        dirty={dirty}
        saving={mutation.isPending}
        onSave={handleSave}
        onDiscard={() => {
          setOverrides({});
          setErrors({});
        }}
        saveLabel={saveLabel}
        savingLabel={t('saving')}
        discardLabel={t('discard')}
        unsavedLabel={t('unsavedChanges')}
      >
        {renderExtraActions?.(saved, dirty)}
      </SaveBar>
    </>
  );
}

// ---------------------------------------------------------------------------
// Security — /admin/security-settings
// ---------------------------------------------------------------------------

export function SecurityTab() {
  const t = useTranslations('admin.securitySettings');
  const query = useAdminSecuritySettings();
  const mutation = useUpdateSecuritySettings();

  const sections: SectionDef[] = [
    {
      title: t('passwordPolicy'),
      icon: KeyRound,
      fields: [
        {
          key: 'MIN_PASSWORD_LENGTH',
          type: 'number',
          label: t('minPasswordLength'),
          hint: t('minPasswordLengthHint'),
          min: 8,
          max: 64,
        },
        {
          key: 'PASSWORD_EXPIRY_DAYS',
          type: 'number',
          label: t('passwordExpiryDays'),
          hint: t('passwordExpiryDesc'),
          notEnforced: t('passwordExpiryNotEnforced'),
          min: 0,
          max: 3650,
        },
        { key: 'REQUIRE_UPPERCASE', type: 'boolean', label: t('requireUppercase') },
        { key: 'REQUIRE_NUMBERS', type: 'boolean', label: t('requireNumbers') },
        { key: 'REQUIRE_SPECIAL_CHARS', type: 'boolean', label: t('requireSpecialChars') },
      ],
    },
    {
      title: t('sessionManagement'),
      icon: Timer,
      fields: [
        {
          key: 'SESSION_TIMEOUT_MINUTES',
          type: 'number',
          label: t('sessionTimeoutMinutes'),
          hint: t('sessionTimeoutHint'),
          min: 5,
          max: 43200,
        },
        {
          key: 'MAX_SESSIONS_PER_USER',
          type: 'number',
          label: t('maxSessionsPerUser'),
          hint: t('maxSessionsHint'),
          min: 1,
          max: 100,
        },
      ],
    },
    {
      title: t('loginProtection'),
      icon: Lock,
      fields: [
        {
          key: 'MAX_LOGIN_ATTEMPTS',
          type: 'number',
          label: t('maxLoginAttempts'),
          hint: t('maxLoginAttemptsHint'),
          min: 3,
          max: 100,
        },
        {
          key: 'LOCKOUT_DURATION_MINUTES',
          type: 'number',
          label: t('lockoutDurationMinutes'),
          hint: t('lockoutDurationHint'),
          min: 1,
          max: 1440,
        },
      ],
    },
    {
      title: t('twoFactorAuth'),
      icon: ShieldCheck,
      fields: [
        {
          key: 'ENABLE_2FA',
          type: 'boolean',
          label: t('enable2FA'),
          notEnforced: t('twoFactorNotEnforced'),
        },
        {
          key: 'ENFORCE_2FA_FOR_ADMINS',
          type: 'boolean',
          label: t('enforce2FAForAdmins'),
          notEnforced: t('twoFactorNotEnforced'),
        },
      ],
    },
  ];

  return (
    <ConfigSettingsForm
      query={query}
      mutation={mutation}
      sections={sections}
      saveLabel={t('saveAll')}
      savedMessage={t('saved')}
    />
  );
}

// ---------------------------------------------------------------------------
// Notifications — /admin/notification-settings
// ---------------------------------------------------------------------------

export function NotificationsTab() {
  const t = useTranslations('admin.notificationSettings');
  const addToast = useToastStore((s) => s.addToast);
  const query = useAdminNotificationSettings();
  const mutation = useUpdateNotificationSettings();
  const testEmail = useTestNotificationEmail();

  const sections: SectionDef[] = [
    {
      title: t('emailNotifications'),
      icon: Mail,
      fields: [
        {
          key: 'ADMIN_ALERT_EMAIL',
          type: 'email',
          label: t('adminAlertEmail'),
          placeholder: t('adminAlertEmailPlaceholder'),
          hint: t('adminAlertEmailHint'),
        },
        {
          key: 'ENABLE_EMAIL_NOTIFICATIONS',
          type: 'boolean',
          label: t('enableEmailNotifications'),
          hint: t('enableEmailNotificationsHint'),
        },
        {
          key: 'DAILY_SUMMARY_EMAIL',
          type: 'boolean',
          label: t('dailySummaryEmail'),
          notEnforced: t('dailySummaryNotEnforced'),
        },
      ],
    },
    {
      title: t('eventTriggers'),
      description: t('eventTriggersHint'),
      icon: Zap,
      fields: [
        { key: 'NOTIFY_NEW_USER_SIGNUP', type: 'boolean', label: t('notifyNewUserSignup') },
        { key: 'NOTIFY_NEW_ORG_CREATED', type: 'boolean', label: t('notifyNewOrgCreated') },
        { key: 'NOTIFY_FAILED_PAYMENT', type: 'boolean', label: t('notifyFailedPayment') },
        {
          key: 'NOTIFY_SYSTEM_ERRORS',
          type: 'boolean',
          label: t('notifySystemErrors'),
          hint: t('notifySystemErrorsHint'),
        },
        { key: 'NOTIFY_NEW_CONTACT_MESSAGE', type: 'boolean', label: t('notifyNewContactMessage') },
        { key: 'NOTIFY_NEW_DEMO_REQUEST', type: 'boolean', label: t('notifyNewDemoRequest') },
      ],
    },
    {
      title: t('errorDigest'),
      icon: AlertOctagon,
      fields: [
        {
          key: 'ERROR_DIGEST_INTERVAL_HOURS',
          type: 'number',
          label: t('errorDigestIntervalHours'),
          notEnforced: t('errorDigestNotEnforced'),
          min: 1,
          max: 168,
        },
      ],
    },
  ];

  return (
    <ConfigSettingsForm
      query={query}
      mutation={mutation}
      sections={sections}
      saveLabel={t('saveAll')}
      savedMessage={t('saved')}
      renderExtraActions={(saved, dirty) => {
        // The API sends the test to the *saved* address, so it must exist and be saved first.
        const canTest = Boolean(saved.ADMIN_ALERT_EMAIL) && !dirty;
        return (
          <button
            type="button"
            disabled={!canTest || testEmail.isPending}
            title={canTest ? undefined : t('testEmailNeedsAddress')}
            onClick={() =>
              testEmail.mutate(undefined, {
                onSuccess: () => addToast('success', t('testEmailSent')),
                onError: () => addToast('error', t('testEmailFailed')),
              })
            }
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testEmail.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4 rtl:-scale-x-100" />
            )}
            {t('sendTestEmail')}
          </button>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Organization defaults — /admin/org-defaults
// ---------------------------------------------------------------------------

const ORG_TIMEZONES = [
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
  'UTC',
];

export function OrgDefaultsTab() {
  const t = useTranslations('admin.orgDefaults');
  const ta = useTranslations('admin');
  const query = useAdminOrgDefaults();
  const mutation = useUpdateOrgDefaults();

  const limit = (
    key: string,
    label: string,
    notes: { hint?: string; notEnforced?: string },
  ): FieldDef => ({
    key,
    type: 'number',
    label,
    ...notes,
    min: 0,
    max: 1_000_000,
  });

  const sections: SectionDef[] = [
    {
      title: t('planAndTrial'),
      icon: Rocket,
      fields: [
        {
          key: 'DEFAULT_PLAN',
          type: 'select',
          label: t('defaultPlan'),
          hint: t('defaultPlanHint'),
          options: (['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const).map((plan) => ({
            value: plan,
            label: ta(`plan_${plan}`),
          })),
        },
        {
          key: 'TRIAL_PERIOD_DAYS',
          type: 'number',
          label: t('trialPeriodDays'),
          notEnforced: t('trialNotEnforced'),
          min: 0,
          max: 365,
        },
        {
          key: 'DEFAULT_TIMEZONE',
          type: 'select',
          label: t('defaultTimezone'),
          options: ORG_TIMEZONES.map((zone) => ({ value: zone, label: zone })),
          ltr: true,
        },
      ],
    },
    {
      title: t('limits'),
      icon: Gauge,
      fields: [
        limit('DEFAULT_MESSAGES_LIMIT', t('defaultMessagesLimit'), {
          hint: t('defaultLimitHint'),
        }),
        limit('DEFAULT_AGENTS_LIMIT', t('defaultAgentsLimit'), { hint: t('defaultLimitHint') }),
        limit('DEFAULT_CHANNELS_LIMIT', t('defaultChannelsLimit'), {
          notEnforced: t('channelsLimitNotEnforced'),
        }),
        limit('DEFAULT_TEAM_MEMBERS_LIMIT', t('defaultTeamMembersLimit'), {
          notEnforced: t('planLimitNotEnforced'),
        }),
        limit('DEFAULT_KB_LIMIT', t('defaultKbLimit'), {
          notEnforced: t('planLimitNotEnforced'),
        }),
      ],
    },
    {
      title: t('onboarding'),
      icon: Building2,
      fields: [
        {
          key: 'AUTO_CREATE_WEBCHAT_CHANNEL',
          type: 'boolean',
          label: t('autoCreateWebchatChannel'),
          hint: t('autoCreateWebchatChannelDesc'),
          notEnforced: t('autoWebchatNotEnforced'),
        },
        {
          key: 'REQUIRE_EMAIL_VERIFICATION',
          type: 'boolean',
          label: t('requireEmailVerification'),
          hint: t('requireEmailVerificationDesc'),
          notEnforced: t('emailVerificationNotEnforced'),
        },
      ],
    },
  ];

  return (
    <ConfigSettingsForm
      query={query}
      mutation={mutation}
      sections={sections}
      saveLabel={t('saveAll')}
      savedMessage={t('saved')}
    />
  );
}
