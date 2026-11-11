import crypto from 'crypto';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { systemSettings } from './systemSettings.service';

/**
 * Per-account login lockout, driven by the admin security settings
 * MAX_LOGIN_ATTEMPTS and LOCKOUT_DURATION_MINUTES.
 *
 * - Failures are counted per *submitted email*, whether or not an account with that
 *   email exists, so the lockout response never reveals which emails are registered.
 * - After MAX_LOGIN_ATTEMPTS failures inside the counting window the email is locked for
 *   LOCKOUT_DURATION_MINUTES. While locked, logins are refused before the password is
 *   even checked, and those refused attempts do NOT extend the lock: it always ends
 *   LOCKOUT_DURATION_MINUTES after it started, so nobody (including a super admin under
 *   attack) can be locked out indefinitely by a single burst.
 * - A successful login, a completed password reset, an admin-set password or an explicit
 *   admin unlock clears the state.
 * - State lives in Redis. If Redis is unavailable the check fails open (the login rate
 *   limiter and IP auto-block still apply) rather than refusing every login.
 */

const FAIL_PREFIX = 'login:fail:';
const LOCK_PREFIX = 'login:lock:';

/** Failures are counted over at least this long, even when the lockout itself is shorter. */
export const MIN_FAILURE_WINDOW_MINUTES = 15;

/** Locks are kept in Redis at most this long (the largest accepted lockout duration). */
const MAX_LOCK_TTL_SECONDS = 24 * 60 * 60;

export interface LockState {
  locked: boolean;
  /** Seconds until the lock ends (0 when not locked). */
  retryAfterSeconds: number;
}

const UNLOCKED: LockState = { locked: false, retryAfterSeconds: 0 };

// ---------------------------------------------------------------------------
// Pure decision logic
// ---------------------------------------------------------------------------

/** Is an account that was locked at `lockedAtMs` still locked at `nowMs`? */
export function evaluateLock(
  lockedAtMs: number | null,
  lockoutDurationMinutes: number,
  nowMs: number,
): LockState {
  if (lockedAtMs === null || !Number.isFinite(lockedAtMs)) return UNLOCKED;
  const remainingMs = lockedAtMs + lockoutDurationMinutes * 60_000 - nowMs;
  if (remainingMs <= 0) return UNLOCKED;
  return { locked: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}

/** Does the `failureCount`-th consecutive failure trigger a lock? */
export function shouldLock(failureCount: number, maxLoginAttempts: number): boolean {
  return failureCount >= maxLoginAttempts;
}

/** Length of the window failures are counted over. */
export function failureWindowSeconds(lockoutDurationMinutes: number): number {
  return Math.max(MIN_FAILURE_WINDOW_MINUTES, lockoutDurationMinutes) * 60;
}

/** Redis key suffix for an email: a hash, so raw addresses are not used as key names. */
export function lockoutKey(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 40);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class LoginLockoutService {
  /** Current lock state for an email. Never throws. */
  async getState(email: string): Promise<LockState> {
    try {
      const raw = await redis.get(`${LOCK_PREFIX}${lockoutKey(email)}`);
      if (raw === null) return UNLOCKED;
      const { lockoutDurationMinutes } = await systemSettings.security();
      return evaluateLock(Number(raw), lockoutDurationMinutes, Date.now());
    } catch (err) {
      logger.warn({ err }, 'Login lockout check failed, allowing attempt');
      return UNLOCKED;
    }
  }

  /**
   * Record a failed credential check for an email and lock it when the configured
   * threshold is reached. Returns the resulting lock state. Never throws.
   */
  async recordFailure(email: string): Promise<LockState> {
    try {
      const { maxLoginAttempts, lockoutDurationMinutes } = await systemSettings.security();
      const key = lockoutKey(email);
      const failKey = `${FAIL_PREFIX}${key}`;

      const count = await redis.incr(failKey);
      if (count === 1 || (await redis.ttl(failKey)) < 0) {
        await redis.expire(failKey, failureWindowSeconds(lockoutDurationMinutes));
      }

      if (!shouldLock(count, maxLoginAttempts)) return UNLOCKED;

      const now = Date.now();
      await redis.set(`${LOCK_PREFIX}${key}`, String(now), 'EX', MAX_LOCK_TTL_SECONDS);
      await redis.del(failKey);
      logger.warn(
        { emailHash: key.slice(0, 12), failures: count, lockoutDurationMinutes },
        'Account locked after repeated failed logins',
      );
      return evaluateLock(now, lockoutDurationMinutes, now);
    } catch (err) {
      logger.warn({ err }, 'Failed to record login failure for lockout');
      return UNLOCKED;
    }
  }

  /** Clear failures and any lock for an email. Returns whether a lock was removed. */
  async clear(email: string): Promise<boolean> {
    try {
      const key = lockoutKey(email);
      const removed = await redis.del(`${LOCK_PREFIX}${key}`);
      await redis.del(`${FAIL_PREFIX}${key}`);
      return removed > 0;
    } catch (err) {
      logger.warn({ err }, 'Failed to clear login lockout state');
      return false;
    }
  }
}

export const loginLockoutService = new LoginLockoutService();
