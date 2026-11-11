import {
  DEFAULT_PASSWORD_POLICY,
  PASSWORD_MAX_LENGTH,
  type PasswordPolicy,
} from '@mojeeb/shared-utils';
import { SubscriptionPlan } from '@mojeeb/shared-types';
import { configService } from './config.service';
import { logger } from '../config/logger';

/**
 * Admin-configurable platform settings (admin panel → Settings → Security /
 * Notifications / Org defaults), stored as SystemConfig rows.
 *
 * This module is the single source of truth for:
 *  - the keys, their seed defaults and the values the admin API accepts, and
 *  - typed, defensive accessors the rest of the backend uses to *enforce* them.
 *
 * Accessors never throw and never return an out-of-range value: a missing,
 * malformed or out-of-range stored value falls back to the default / is clamped,
 * so a bad row can neither lock everybody out nor switch a check off.
 *
 * `enforced: false` marks settings that are stored but that no backend code acts on
 * (the feature they describe does not exist yet). The admin UI shows them as such.
 */

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

type SettingKind =
  | { kind: 'int'; min: number; max: number }
  | { kind: 'bool' }
  | { kind: 'email' }
  | { kind: 'enum'; options: readonly string[] }
  | { kind: 'timezone' };

export type SettingDef = SettingKind & {
  value: string;
  label: string;
  description: string;
  isSecret: boolean;
  /** Whether backend code acts on this setting. */
  enforced: boolean;
};

const int = (
  value: number,
  min: number,
  max: number,
  label: string,
  description: string,
  enforced = true,
): SettingDef => ({
  kind: 'int',
  min,
  max,
  value: String(value),
  label,
  description,
  isSecret: false,
  enforced,
});

const bool = (value: boolean, label: string, description: string, enforced = true): SettingDef => ({
  kind: 'bool',
  value: String(value),
  label,
  description,
  isSecret: false,
  enforced,
});

/** Session lifetime before this setting was enforced: refresh tokens lived 7 days. */
const LEGACY_SESSION_MINUTES = 7 * 24 * 60;

export const SECURITY_DEFAULTS = {
  MIN_PASSWORD_LENGTH: int(
    DEFAULT_PASSWORD_POLICY.minLength,
    8,
    64,
    'Minimum Password Length',
    'Minimum number of characters required for passwords',
  ),
  REQUIRE_UPPERCASE: bool(
    DEFAULT_PASSWORD_POLICY.requireUppercase,
    'Require Uppercase',
    'Require at least one uppercase letter',
  ),
  REQUIRE_NUMBERS: bool(
    DEFAULT_PASSWORD_POLICY.requireNumbers,
    'Require Numbers',
    'Require at least one number',
  ),
  REQUIRE_SPECIAL_CHARS: bool(
    DEFAULT_PASSWORD_POLICY.requireSpecialChars,
    'Require Special Characters',
    'Require at least one special character',
  ),
  PASSWORD_EXPIRY_DAYS: int(
    0,
    0,
    3650,
    'Password Expiry (Days)',
    'Days before password expires (0 = never)',
    false,
  ),
  SESSION_TIMEOUT_MINUTES: int(
    LEGACY_SESSION_MINUTES,
    5,
    43200,
    'Session Timeout (Minutes)',
    'Minutes of inactivity before a session must sign in again (10080 = 7 days)',
  ),
  MAX_SESSIONS_PER_USER: int(
    5,
    1,
    100,
    'Max Sessions Per User',
    'Maximum concurrent sessions allowed per user',
  ),
  MAX_LOGIN_ATTEMPTS: int(
    10,
    3,
    100,
    'Max Login Attempts',
    'Maximum failed login attempts before lockout',
  ),
  LOCKOUT_DURATION_MINUTES: int(
    30,
    1,
    1440,
    'Lockout Duration (Minutes)',
    'Account lockout duration after max failed attempts',
  ),
  ENABLE_2FA: bool(false, 'Enable Two-Factor Auth', 'Allow users to enable 2FA', false),
  ENFORCE_2FA_FOR_ADMINS: bool(
    false,
    'Enforce 2FA for Admins',
    'Require 2FA for all admin users',
    false,
  ),
} satisfies Record<string, SettingDef>;

export const NOTIFICATION_DEFAULTS = {
  ENABLE_EMAIL_NOTIFICATIONS: bool(
    true,
    'Enable Email Notifications',
    'Master switch for admin alert emails',
  ),
  ADMIN_ALERT_EMAIL: {
    kind: 'email',
    value: '',
    label: 'Admin Alert Email',
    description: 'Email address for admin alerts (leave empty for no alerts)',
    isSecret: false,
    enforced: true,
  },
  NOTIFY_NEW_USER_SIGNUP: bool(
    true,
    'New User Signup',
    'Send notification when a new user registers',
  ),
  NOTIFY_NEW_ORG_CREATED: bool(
    true,
    'New Organization',
    'Send notification when a new organization is created',
  ),
  NOTIFY_FAILED_PAYMENT: bool(true, 'Failed Payment', 'Send notification on payment failures'),
  NOTIFY_SYSTEM_ERRORS: bool(true, 'System Errors', 'Send notification on critical system errors'),
  NOTIFY_NEW_CONTACT_MESSAGE: bool(
    true,
    'New Contact Message',
    'Send notification for new contact form submissions',
  ),
  NOTIFY_NEW_DEMO_REQUEST: bool(
    true,
    'New Demo Request',
    'Send notification for new demo requests',
  ),
  ERROR_DIGEST_INTERVAL_HOURS: int(
    24,
    1,
    168,
    'Error Digest Interval (Hours)',
    'Send error digest every N hours',
    false,
  ),
  DAILY_SUMMARY_EMAIL: bool(
    false,
    'Daily Summary Email',
    'Send daily platform summary email to admin',
    false,
  ),
} satisfies Record<string, SettingDef>;

const PLAN_OPTIONS = Object.values(SubscriptionPlan) as string[];

export const ORG_DEFAULTS = {
  DEFAULT_PLAN: {
    kind: 'enum',
    options: PLAN_OPTIONS,
    value: 'FREE',
    label: 'Default Plan',
    description: 'Default subscription plan for new organizations',
    isSecret: false,
    enforced: true,
  },
  TRIAL_PERIOD_DAYS: int(
    14,
    0,
    365,
    'Trial Period (Days)',
    'Number of trial days for new organizations',
    false,
  ),
  DEFAULT_TIMEZONE: {
    kind: 'timezone',
    value: 'Asia/Riyadh',
    label: 'Default Timezone',
    description: 'Default timezone for new organizations',
    isSecret: false,
    enforced: true,
  },
  DEFAULT_MESSAGES_LIMIT: int(
    100,
    0,
    1_000_000,
    'Default Messages Limit',
    'Default monthly message limit',
  ),
  DEFAULT_AGENTS_LIMIT: int(1, 0, 1_000_000, 'Default Agents Limit', 'Default AI agents limit'),
  DEFAULT_CHANNELS_LIMIT: int(
    1,
    0,
    1_000_000,
    'Default Channels Limit',
    'Default channels limit',
    false,
  ),
  DEFAULT_TEAM_MEMBERS_LIMIT: int(
    2,
    0,
    1_000_000,
    'Default Team Members Limit',
    'Default team members limit',
    false,
  ),
  DEFAULT_KB_LIMIT: int(
    1,
    0,
    1_000_000,
    'Default Knowledge Bases Limit',
    'Default knowledge bases limit',
    false,
  ),
  AUTO_CREATE_WEBCHAT_CHANNEL: bool(
    true,
    'Auto-Create Webchat Channel',
    'Automatically create a webchat channel for new organizations',
    false,
  ),
  REQUIRE_EMAIL_VERIFICATION: bool(
    true,
    'Require Email Verification',
    'Require email verification for new users',
    false,
  ),
} satisfies Record<string, SettingDef>;

// ---------------------------------------------------------------------------
// Parsing (pure)
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parse a stored integer; anything that is not a plain integer yields `fallback`. Clamped. */
export function parseIntSetting(
  raw: string | null | undefined,
  opts: { fallback: number; min: number; max: number },
): number {
  const text = (raw ?? '').trim();
  if (!/^\d{1,9}$/.test(text)) return opts.fallback;
  return Math.min(opts.max, Math.max(opts.min, Number(text)));
}

/** Parse a stored boolean; anything other than true/false yields `fallback`. */
export function parseBoolSetting(raw: string | null | undefined, fallback: boolean): boolean {
  const text = (raw ?? '').trim().toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return fallback;
}

export function isValidTimezone(zone: string): boolean {
  if (!zone || zone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a value an admin is trying to store. Returns an error message, or null when
 * the value is acceptable. Used by the admin settings routes so an out-of-range value is
 * rejected visibly instead of being silently clamped later.
 */
export function validateSettingValue(def: SettingDef, raw: string): string | null {
  const value = raw.trim();
  switch (def.kind) {
    case 'int': {
      if (!/^\d{1,9}$/.test(value)) return 'must be a whole number';
      const n = Number(value);
      if (n < def.min || n > def.max) return `must be between ${def.min} and ${def.max}`;
      return null;
    }
    case 'bool':
      return value === 'true' || value === 'false' ? null : 'must be "true" or "false"';
    case 'email':
      return value === '' || (value.length <= 254 && EMAIL_RE.test(value))
        ? null
        : 'must be a valid email address or empty';
    case 'enum':
      return def.options.includes(value) ? null : `must be one of: ${def.options.join(', ')}`;
    case 'timezone':
      return isValidTimezone(value) ? null : 'must be a valid IANA timezone';
  }
}

function intFrom(def: SettingDef, raw: string | undefined): number {
  if (def.kind !== 'int') throw new Error('not an integer setting');
  return parseIntSetting(raw, { fallback: Number(def.value), min: def.min, max: def.max });
}

function boolFrom(def: SettingDef, raw: string | undefined): boolean {
  return parseBoolSetting(raw, def.value === 'true');
}

// ---------------------------------------------------------------------------
// Typed views
// ---------------------------------------------------------------------------

export interface SecuritySettings {
  passwordPolicy: PasswordPolicy;
  /** Idle lifetime of a session (refresh token), in minutes. */
  sessionTimeoutMinutes: number;
  maxSessionsPerUser: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
}

type RawValues = Record<string, string | undefined>;

export function resolveSecuritySettings(raw: RawValues): SecuritySettings {
  const d = SECURITY_DEFAULTS;
  return {
    passwordPolicy: {
      minLength: Math.min(
        PASSWORD_MAX_LENGTH,
        intFrom(d.MIN_PASSWORD_LENGTH, raw.MIN_PASSWORD_LENGTH),
      ),
      requireUppercase: boolFrom(d.REQUIRE_UPPERCASE, raw.REQUIRE_UPPERCASE),
      requireNumbers: boolFrom(d.REQUIRE_NUMBERS, raw.REQUIRE_NUMBERS),
      requireSpecialChars: boolFrom(d.REQUIRE_SPECIAL_CHARS, raw.REQUIRE_SPECIAL_CHARS),
    },
    sessionTimeoutMinutes: intFrom(d.SESSION_TIMEOUT_MINUTES, raw.SESSION_TIMEOUT_MINUTES),
    maxSessionsPerUser: intFrom(d.MAX_SESSIONS_PER_USER, raw.MAX_SESSIONS_PER_USER),
    maxLoginAttempts: intFrom(d.MAX_LOGIN_ATTEMPTS, raw.MAX_LOGIN_ATTEMPTS),
    lockoutDurationMinutes: intFrom(d.LOCKOUT_DURATION_MINUTES, raw.LOCKOUT_DURATION_MINUTES),
  };
}

export type AdminAlertEvent =
  | 'NEW_USER_SIGNUP'
  | 'NEW_ORG_CREATED'
  | 'FAILED_PAYMENT'
  | 'SYSTEM_ERRORS'
  | 'NEW_CONTACT_MESSAGE'
  | 'NEW_DEMO_REQUEST';

export interface NotificationSettings {
  /** Which admin alerts are sent at all (in-app notification and email). */
  events: Record<AdminAlertEvent, boolean>;
  /** Address admin alerts are emailed to; null when emails are off or no valid address is set. */
  alertEmail: string | null;
}

export function resolveNotificationSettings(raw: RawValues): NotificationSettings {
  const d = NOTIFICATION_DEFAULTS;
  const emailEnabled = boolFrom(d.ENABLE_EMAIL_NOTIFICATIONS, raw.ENABLE_EMAIL_NOTIFICATIONS);
  const address = (raw.ADMIN_ALERT_EMAIL ?? '').trim();
  return {
    events: {
      NEW_USER_SIGNUP: boolFrom(d.NOTIFY_NEW_USER_SIGNUP, raw.NOTIFY_NEW_USER_SIGNUP),
      NEW_ORG_CREATED: boolFrom(d.NOTIFY_NEW_ORG_CREATED, raw.NOTIFY_NEW_ORG_CREATED),
      FAILED_PAYMENT: boolFrom(d.NOTIFY_FAILED_PAYMENT, raw.NOTIFY_FAILED_PAYMENT),
      SYSTEM_ERRORS: boolFrom(d.NOTIFY_SYSTEM_ERRORS, raw.NOTIFY_SYSTEM_ERRORS),
      NEW_CONTACT_MESSAGE: boolFrom(d.NOTIFY_NEW_CONTACT_MESSAGE, raw.NOTIFY_NEW_CONTACT_MESSAGE),
      NEW_DEMO_REQUEST: boolFrom(d.NOTIFY_NEW_DEMO_REQUEST, raw.NOTIFY_NEW_DEMO_REQUEST),
    },
    alertEmail: emailEnabled && address.length <= 254 && EMAIL_RE.test(address) ? address : null,
  };
}

export interface NewOrgDefaults {
  plan: SubscriptionPlan;
  /** null = leave the column default. */
  timezone: string | null;
  /** null = use the plan's own limit. */
  messagesLimit: number | null;
  /** null = use the plan's own limit. */
  agentsLimit: number | null;
}

/**
 * Defaults applied to a newly created organization. Unlike the security settings, a key
 * that is not stored at all yields "no override" (plan limits / column default) so that an
 * installation that never touched these settings behaves exactly as before.
 */
export function resolveNewOrgDefaults(raw: RawValues): NewOrgDefaults {
  const d = ORG_DEFAULTS;
  const plan = (raw.DEFAULT_PLAN ?? '').trim();
  const zone = (raw.DEFAULT_TIMEZONE ?? '').trim();
  const limit = (def: SettingDef, value: string | undefined): number | null => {
    if (def.kind !== 'int' || !/^\d{1,9}$/.test((value ?? '').trim())) return null;
    return intFrom(def, value);
  };
  return {
    plan: PLAN_OPTIONS.includes(plan) ? (plan as SubscriptionPlan) : SubscriptionPlan.FREE,
    timezone: isValidTimezone(zone) ? zone : null,
    messagesLimit: limit(d.DEFAULT_MESSAGES_LIMIT, raw.DEFAULT_MESSAGES_LIMIT),
    agentsLimit: limit(d.DEFAULT_AGENTS_LIMIT, raw.DEFAULT_AGENTS_LIMIT),
  };
}

// ---------------------------------------------------------------------------
// Accessors (cached through configService: Redis, then DB)
// ---------------------------------------------------------------------------

async function readRaw(keys: readonly string[]): Promise<RawValues> {
  const entries = await Promise.all(
    keys.map(async (key) => {
      try {
        return [key, await configService.get(key)] as const;
      } catch (err) {
        // Never let a config read failure break auth: fall back to the default.
        logger.warn({ err, key }, 'Failed to read system setting, using default');
        return [key, undefined] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

export const systemSettings = {
  async security(): Promise<SecuritySettings> {
    return resolveSecuritySettings(await readRaw(Object.keys(SECURITY_DEFAULTS)));
  },

  async passwordPolicy(): Promise<PasswordPolicy> {
    return (await this.security()).passwordPolicy;
  },

  async notifications(): Promise<NotificationSettings> {
    return resolveNotificationSettings(await readRaw(Object.keys(NOTIFICATION_DEFAULTS)));
  },

  async newOrgDefaults(): Promise<NewOrgDefaults> {
    return resolveNewOrgDefaults(
      await readRaw([
        'DEFAULT_PLAN',
        'DEFAULT_TIMEZONE',
        'DEFAULT_MESSAGES_LIMIT',
        'DEFAULT_AGENTS_LIMIT',
      ]),
    );
  },
};
