import { redis } from './redis';
import { logger } from './logger';

export class CacheService {
  /**
   * Get a cached value by key. Returns null if not found or on error.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redis.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.error({ err, key }, 'Cache get error');
      return null;
    }
  }

  /**
   * Set a value in the cache with a TTL in seconds.
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await redis.set(key, serialized, 'EX', ttlSeconds);
    } catch (err) {
      logger.error({ err, key }, 'Cache set error');
    }
  }

  /**
   * Delete a single cache key.
   */
  async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (err) {
      logger.error({ err, key }, 'Cache del error');
    }
  }

  /**
   * Delete all keys matching a glob-style pattern (e.g. 'agent:*').
   * Uses SCAN to avoid blocking Redis on large keyspaces.
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      logger.error({ err, pattern }, 'Cache delPattern error');
    }
  }

  /**
   * Get a cached value, or fetch it via the callback and cache the result.
   * If the cache is unavailable the callback result is still returned.
   */
  async getOrSet<T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await fetchFn();
    // Fire-and-forget: don't let cache failure block the response
    this.set(key, value, ttlSeconds).catch(() => {});
    return value;
  }
}

export const cache = new CacheService();
