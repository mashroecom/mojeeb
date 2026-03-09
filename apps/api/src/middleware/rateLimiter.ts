import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis';

const isDev = process.env.NODE_ENV !== 'production';

// Note: Express 'trust proxy' must be set in the main app for req.ip to work behind reverse proxies.
// See: app.set('trust proxy', 1) in index.ts

// Shared Redis store factory — ensures rate limit counters survive API restarts
// and are shared across multiple server instances.
function createRedisStore(prefix: string) {
  return new RedisStore({
    // Use ioredis .call() to send raw Redis commands
    sendCommand: (...args: string[]) =>
      (redis as any).call(...args),
    prefix: `rl:${prefix}:`,
  });
}

/**
 * Extract a reliable key for rate limiting.
 * Prefers authenticated user ID, falls back to IP address.
 */
function getClientKey(req: any): string {
  if (req.user?.userId) return req.user.userId;
  return req.ip || req.socket?.remoteAddress || 'anon-unknown';
}

export const apiLimiter = rateLimit({
  store: createRedisStore('api'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMITED',
  },
});

export const authLimiter = rateLimit({
  store: createRedisStore('auth'),
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || 'anon-unknown',
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    code: 'RATE_LIMITED',
  },
});

export const webhookLimiter = rateLimit({
  store: createRedisStore('webhook'),
  windowMs: 1 * 60 * 1000,
  max: 1000,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || 'webhook-unknown',
});

/** Per-API-key rate limiter — stricter limits for programmatic API access. */
export const apiKeyLimiter = rateLimit({
  store: createRedisStore('apikey'),
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDev ? 500 : 60, // 60 requests/min per API key in production
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use the API key hash as the rate limit key (set by apiKeyAuth middleware)
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (apiKey) return `apikey:${apiKey.slice(0, 8)}`; // Use prefix for privacy
    return getClientKey(req);
  },
  message: {
    success: false,
    error: 'API key rate limit exceeded. Please reduce request frequency.',
    code: 'RATE_LIMITED',
  },
});

/** Token refresh rate limiter — prevents abuse of refresh token endpoint. */
export const tokenRefreshLimiter = rateLimit({
  store: createRedisStore('token-refresh'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 5 : 3, // Very strict: 3 refreshes per 15 minutes in production
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  message: {
    success: false,
    error: 'Too many token refresh attempts, please try again later',
    code: 'RATE_LIMITED',
  },
});
