import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn<(key: string) => Promise<string>>(),
}));

vi.mock('./config.service', () => ({ configService: { get: mocks.get } }));
vi.mock('../config/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import {
  NOTIFICATION_DEFAULTS,
  ORG_DEFAULTS,
  SECURITY_DEFAULTS,
  parseBoolSetting,
  parseIntSetting,
  resolveNewOrgDefaults,
  resolveNotificationSettings,
  resolveSecuritySettings,
  systemSettings,
  validateSettingValue,
} from './systemSettings.service';

function stored(values: Record<string, string>) {
  mocks.get.mockImplementation(async (key: string) => values[key] ?? '');
}

beforeEach(() => {
  mocks.get.mockReset();
});

describe('parseIntSetting', () => {
  const opts = { fallback: 10, min: 3, max: 100 };

  it('returns the stored value when it is in range', () => {
    expect(parseIntSetting('25', opts)).toBe(25);
    expect(parseIntSetting(' 7 ', opts)).toBe(7);
  });

  it('clamps out-of-range values instead of trusting them', () => {
    expect(parseIntSetting('0', opts)).toBe(3);
    expect(parseIntSetting('1', opts)).toBe(3);
    expect(parseIntSetting('999999', opts)).toBe(100);
  });

  it('falls back to the default for anything that is not a plain integer', () => {
    for (const bad of ['', '  ', 'abc', '-5', '1.5', '1e3', 'NaN', '12345678901234567890']) {
      expect(parseIntSetting(bad, opts)).toBe(10);
    }
    expect(parseIntSetting(undefined, opts)).toBe(10);
    expect(parseIntSetting(null, opts)).toBe(10);
  });
});

describe('parseBoolSetting', () => {
  it('accepts only true/false', () => {
    expect(parseBoolSetting('true', false)).toBe(true);
    expect(parseBoolSetting('FALSE', true)).toBe(false);
  });

  it('falls back to the default for anything else', () => {
    for (const bad of ['', 'yes', '1', '0', 'null']) {
      expect(parseBoolSetting(bad, true)).toBe(true);
      expect(parseBoolSetting(bad, false)).toBe(false);
    }
    expect(parseBoolSetting(undefined, true)).toBe(true);
  });
});

describe('resolveSecuritySettings', () => {
  it('uses the seed defaults when nothing is stored', () => {
    expect(resolveSecuritySettings({})).toEqual({
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
      },
      sessionTimeoutMinutes: 7 * 24 * 60, // refresh tokens lived 7 days before the setting
      maxSessionsPerUser: 5,
      maxLoginAttempts: 10,
      lockoutDurationMinutes: 30,
    });
  });

  it('matches the defaults the admin API seeds', () => {
    const seeded = Object.fromEntries(
      Object.entries(SECURITY_DEFAULTS).map(([key, def]) => [key, def.value]),
    );
    expect(resolveSecuritySettings(seeded)).toEqual(resolveSecuritySettings({}));
  });

  it('applies stored values', () => {
    const s = resolveSecuritySettings({
      MIN_PASSWORD_LENGTH: '12',
      REQUIRE_UPPERCASE: 'false',
      REQUIRE_NUMBERS: 'false',
      REQUIRE_SPECIAL_CHARS: 'true',
      SESSION_TIMEOUT_MINUTES: '60',
      MAX_SESSIONS_PER_USER: '2',
      MAX_LOGIN_ATTEMPTS: '5',
      LOCKOUT_DURATION_MINUTES: '15',
    });
    expect(s.passwordPolicy).toEqual({
      minLength: 12,
      requireUppercase: false,
      requireNumbers: false,
      requireSpecialChars: true,
    });
    expect(s.sessionTimeoutMinutes).toBe(60);
    expect(s.maxSessionsPerUser).toBe(2);
    expect(s.maxLoginAttempts).toBe(5);
    expect(s.lockoutDurationMinutes).toBe(15);
  });

  it('never lets a bad value switch a check off or lock everyone out', () => {
    const s = resolveSecuritySettings({
      MIN_PASSWORD_LENGTH: '0', // would accept empty passwords
      MAX_LOGIN_ATTEMPTS: '0', // would lock every account on the first attempt
      LOCKOUT_DURATION_MINUTES: '99999999', // would lock for years
      SESSION_TIMEOUT_MINUTES: '0', // would expire every session immediately
      MAX_SESSIONS_PER_USER: '0', // would evict the session that was just created
      REQUIRE_UPPERCASE: 'garbage',
    });
    expect(s.passwordPolicy.minLength).toBe(8);
    expect(s.passwordPolicy.requireUppercase).toBe(true);
    expect(s.maxLoginAttempts).toBe(3);
    expect(s.lockoutDurationMinutes).toBe(1440);
    expect(s.sessionTimeoutMinutes).toBe(5);
    expect(s.maxSessionsPerUser).toBe(1);
  });

  it('caps an absurd minimum length so a password can still be chosen', () => {
    expect(resolveSecuritySettings({ MIN_PASSWORD_LENGTH: '5000' }).passwordPolicy.minLength).toBe(
      64,
    );
  });
});

describe('resolveNotificationSettings', () => {
  it('sends every alert in-app and no email by default', () => {
    const n = resolveNotificationSettings({});
    expect(Object.values(n.events).every(Boolean)).toBe(true);
    expect(n.alertEmail).toBeNull();
  });

  it('honours the per-event toggles', () => {
    const n = resolveNotificationSettings({
      NOTIFY_NEW_USER_SIGNUP: 'false',
      NOTIFY_NEW_DEMO_REQUEST: 'false',
    });
    expect(n.events.NEW_USER_SIGNUP).toBe(false);
    expect(n.events.NEW_DEMO_REQUEST).toBe(false);
    expect(n.events.NEW_CONTACT_MESSAGE).toBe(true);
  });

  it('emails alerts only when enabled and the address is valid', () => {
    expect(resolveNotificationSettings({ ADMIN_ALERT_EMAIL: 'ops@example.com' }).alertEmail).toBe(
      'ops@example.com',
    );
    expect(
      resolveNotificationSettings({
        ADMIN_ALERT_EMAIL: 'ops@example.com',
        ENABLE_EMAIL_NOTIFICATIONS: 'false',
      }).alertEmail,
    ).toBeNull();
    expect(
      resolveNotificationSettings({ ADMIN_ALERT_EMAIL: 'not-an-email' }).alertEmail,
    ).toBeNull();
  });
});

describe('resolveNewOrgDefaults', () => {
  it('overrides nothing when the settings were never stored', () => {
    expect(resolveNewOrgDefaults({})).toEqual({
      plan: 'FREE',
      timezone: null,
      messagesLimit: null,
      agentsLimit: null,
    });
  });

  it('applies stored defaults', () => {
    expect(
      resolveNewOrgDefaults({
        DEFAULT_PLAN: 'STARTER',
        DEFAULT_TIMEZONE: 'Africa/Cairo',
        DEFAULT_MESSAGES_LIMIT: '250',
        DEFAULT_AGENTS_LIMIT: '3',
      }),
    ).toEqual({ plan: 'STARTER', timezone: 'Africa/Cairo', messagesLimit: 250, agentsLimit: 3 });
  });

  it('ignores invalid plans, timezones and limits', () => {
    expect(
      resolveNewOrgDefaults({
        DEFAULT_PLAN: 'PLATINUM',
        DEFAULT_TIMEZONE: 'Mars/Olympus',
        DEFAULT_MESSAGES_LIMIT: 'lots',
        DEFAULT_AGENTS_LIMIT: '-1',
      }),
    ).toEqual({ plan: 'FREE', timezone: null, messagesLimit: null, agentsLimit: null });
  });

  it('clamps huge limits', () => {
    expect(resolveNewOrgDefaults({ DEFAULT_MESSAGES_LIMIT: '999999999' }).messagesLimit).toBe(
      1_000_000,
    );
  });
});

describe('validateSettingValue', () => {
  it('accepts every seed default', () => {
    for (const defs of [SECURITY_DEFAULTS, NOTIFICATION_DEFAULTS, ORG_DEFAULTS]) {
      for (const [key, def] of Object.entries(defs)) {
        expect(validateSettingValue(def, def.value), key).toBeNull();
      }
    }
  });

  it('rejects out-of-range and malformed values', () => {
    expect(validateSettingValue(SECURITY_DEFAULTS.MIN_PASSWORD_LENGTH, '6')).toMatch(/between/);
    expect(validateSettingValue(SECURITY_DEFAULTS.MIN_PASSWORD_LENGTH, '65')).toMatch(/between/);
    expect(validateSettingValue(SECURITY_DEFAULTS.MAX_LOGIN_ATTEMPTS, '1')).toMatch(/between/);
    expect(validateSettingValue(SECURITY_DEFAULTS.MAX_LOGIN_ATTEMPTS, 'ten')).toMatch(/whole/);
    expect(validateSettingValue(SECURITY_DEFAULTS.REQUIRE_UPPERCASE, 'yes')).not.toBeNull();
    expect(validateSettingValue(NOTIFICATION_DEFAULTS.ADMIN_ALERT_EMAIL, 'nope')).not.toBeNull();
    expect(validateSettingValue(NOTIFICATION_DEFAULTS.ADMIN_ALERT_EMAIL, '')).toBeNull();
    expect(validateSettingValue(ORG_DEFAULTS.DEFAULT_PLAN, 'PLATINUM')).not.toBeNull();
    expect(validateSettingValue(ORG_DEFAULTS.DEFAULT_TIMEZONE, 'Mars/Olympus')).not.toBeNull();
    expect(validateSettingValue(ORG_DEFAULTS.DEFAULT_TIMEZONE, 'Asia/Dubai')).toBeNull();
  });
});

describe('systemSettings accessors', () => {
  it('reads through configService and resolves typed values', async () => {
    stored({ MIN_PASSWORD_LENGTH: '12', MAX_LOGIN_ATTEMPTS: '4' });
    const s = await systemSettings.security();
    expect(s.passwordPolicy.minLength).toBe(12);
    expect(s.maxLoginAttempts).toBe(4);
    expect(s.lockoutDurationMinutes).toBe(30);
    expect(mocks.get).toHaveBeenCalledWith('MIN_PASSWORD_LENGTH');
  });

  it('treats missing rows (empty string) as defaults', async () => {
    stored({});
    expect(await systemSettings.passwordPolicy()).toEqual({
      minLength: 8,
      requireUppercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
    });
  });

  it('falls back to defaults when the config store throws', async () => {
    mocks.get.mockRejectedValue(new Error('db down'));
    const s = await systemSettings.security();
    expect(s.maxLoginAttempts).toBe(10);
    expect(s.passwordPolicy.minLength).toBe(8);
    expect((await systemSettings.notifications()).alertEmail).toBeNull();
    expect((await systemSettings.newOrgDefaults()).plan).toBe('FREE');
  });
});
