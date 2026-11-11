import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();
  return {
    store,
    ttls,
    settings: { maxLoginAttempts: 3, lockoutDurationMinutes: 10 },
    failRedis: false,
    redis: {
      get: vi.fn(async (key: string) => {
        if (mocks.failRedis) throw new Error('redis down');
        return store.get(key) ?? null;
      }),
      set: vi.fn(async (key: string, value: string, _ex: string, ttl: number) => {
        store.set(key, value);
        ttls.set(key, ttl);
        return 'OK';
      }),
      incr: vi.fn(async (key: string) => {
        if (mocks.failRedis) throw new Error('redis down');
        const next = Number(store.get(key) ?? '0') + 1;
        store.set(key, String(next));
        return next;
      }),
      ttl: vi.fn(async (key: string) => ttls.get(key) ?? -1),
      expire: vi.fn(async (key: string, ttl: number) => {
        ttls.set(key, ttl);
        return 1;
      }),
      del: vi.fn(async (key: string) => {
        ttls.delete(key);
        return store.delete(key) ? 1 : 0;
      }),
    },
  };
});

vi.mock('../config/redis', () => ({ redis: mocks.redis }));
vi.mock('../config/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));
vi.mock('./systemSettings.service', () => ({
  systemSettings: { security: vi.fn(async () => mocks.settings) },
}));

import {
  LoginLockoutService,
  evaluateLock,
  failureWindowSeconds,
  lockoutKey,
  shouldLock,
} from './loginLockout.service';

const service = new LoginLockoutService();

beforeEach(() => {
  mocks.store.clear();
  mocks.ttls.clear();
  mocks.failRedis = false;
  mocks.settings = { maxLoginAttempts: 3, lockoutDurationMinutes: 10 };
  vi.useRealTimers();
});

describe('lockout decision (pure)', () => {
  it('locks on the Nth failure, not before', () => {
    expect(shouldLock(4, 5)).toBe(false);
    expect(shouldLock(5, 5)).toBe(true);
    expect(shouldLock(6, 5)).toBe(true);
  });

  it('is locked for exactly the configured duration', () => {
    const t0 = 1_000_000;
    expect(evaluateLock(t0, 15, t0)).toEqual({ locked: true, retryAfterSeconds: 900 });
    expect(evaluateLock(t0, 15, t0 + 14 * 60_000 + 59_000)).toEqual({
      locked: true,
      retryAfterSeconds: 1,
    });
    expect(evaluateLock(t0, 15, t0 + 15 * 60_000)).toEqual({ locked: false, retryAfterSeconds: 0 });
  });

  it('is not locked without a lock record or with a corrupt one', () => {
    expect(evaluateLock(null, 15, Date.now()).locked).toBe(false);
    expect(evaluateLock(Number('garbage'), 15, Date.now()).locked).toBe(false);
  });

  it('shortening the duration releases existing locks early', () => {
    const t0 = 1_000_000;
    expect(evaluateLock(t0, 30, t0 + 10 * 60_000).locked).toBe(true);
    expect(evaluateLock(t0, 5, t0 + 10 * 60_000).locked).toBe(false);
  });

  it('counts failures over at least 15 minutes', () => {
    expect(failureWindowSeconds(1)).toBe(15 * 60);
    expect(failureWindowSeconds(60)).toBe(60 * 60);
  });

  it('derives the same key regardless of case and whitespace, without the raw email', () => {
    expect(lockoutKey(' Admin@Example.com ')).toBe(lockoutKey('admin@example.com'));
    expect(lockoutKey('admin@example.com')).not.toContain('admin');
    expect(lockoutKey('a@example.com')).not.toBe(lockoutKey('b@example.com'));
  });
});

describe('LoginLockoutService', () => {
  const email = 'victim@example.com';

  it('locks after the configured number of failures', async () => {
    expect((await service.recordFailure(email)).locked).toBe(false);
    expect((await service.recordFailure(email)).locked).toBe(false);
    expect((await service.getState(email)).locked).toBe(false);

    const third = await service.recordFailure(email);
    expect(third).toEqual({ locked: true, retryAfterSeconds: 600 });
    expect((await service.getState(email)).locked).toBe(true);
  });

  it('treats unknown and known emails identically (no account lookup involved)', async () => {
    for (let i = 0; i < 3; i++) await service.recordFailure('nobody@example.com');
    expect((await service.getState('nobody@example.com')).locked).toBe(true);
  });

  it('does not lock other accounts', async () => {
    for (let i = 0; i < 3; i++) await service.recordFailure(email);
    expect((await service.getState('other@example.com')).locked).toBe(false);
  });

  it('unlocks by itself once the lockout duration has passed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    for (let i = 0; i < 3; i++) await service.recordFailure(email);
    expect((await service.getState(email)).locked).toBe(true);

    vi.setSystemTime(new Date('2026-01-01T00:09:59Z'));
    expect((await service.getState(email)).locked).toBe(true);

    vi.setSystemTime(new Date('2026-01-01T00:10:00Z'));
    expect((await service.getState(email)).locked).toBe(false);
  });

  it('starts counting from zero again after a lock', async () => {
    for (let i = 0; i < 3; i++) await service.recordFailure(email);
    await service.clear(email);
    expect((await service.recordFailure(email)).locked).toBe(false);
  });

  it('clear() removes the lock and reports whether there was one', async () => {
    expect(await service.clear(email)).toBe(false);
    for (let i = 0; i < 3; i++) await service.recordFailure(email);
    expect(await service.clear(email)).toBe(true);
    expect((await service.getState(email)).locked).toBe(false);
  });

  it('expires the failure counter so old failures are forgotten', async () => {
    await service.recordFailure(email);
    const failKey = [...mocks.store.keys()].find((k) => k.startsWith('login:fail:'))!;
    expect(mocks.ttls.get(failKey)).toBe(15 * 60);
  });

  it('fails open when Redis is unavailable', async () => {
    mocks.failRedis = true;
    expect(await service.getState(email)).toEqual({ locked: false, retryAfterSeconds: 0 });
    expect(await service.recordFailure(email)).toEqual({ locked: false, retryAfterSeconds: 0 });
  });
});
