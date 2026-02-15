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

export const apiLimiter = rateLimit({
  store: createRedisStore('api'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user?.userId || req.ip || req.socket?.remoteAddress || req.headers['x-forwarded-for'] as string || 'anon-unknown',
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
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || req.headers['x-forwarded-for'] as string || 'anon-unknown',
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
});
