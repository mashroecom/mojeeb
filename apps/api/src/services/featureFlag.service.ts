import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

const FF_PREFIX = 'ff:';
const FF_TTL = 300; // 5 minutes cache

export class FeatureFlagService {
  /**
   * Check if a feature flag is enabled.
   * Redis cache with 300s TTL, fallback to DB.
   */
  async isEnabled(key: string): Promise<boolean> {
    const cacheKey = `${FF_PREFIX}${key}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null) return cached === '1';
    } catch (err) {
      logger.warn({ err }, 'Redis error checking feature flag, falling back to DB');
    }

    // Cache miss — check DB
    const flag = await prisma.featureFlag.findUnique({
      where: { key },
      select: { enabled: true },
    });

    const enabled = flag?.enabled ?? false;

    // Cache the result
    try {
      await redis.set(cacheKey, enabled ? '1' : '0', 'EX', FF_TTL);
    } catch {}

    return enabled;
  }

  /**
   * Get all feature flags
   */
  async getAll() {
    return prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Create a new feature flag
   */
  async create(params: { key: string; description?: string; enabled?: boolean }) {
    const flag = await prisma.featureFlag.create({
      data: {
        key: params.key,
        description: params.description ?? '',
        enabled: params.enabled ?? false,
      },
    });

    // Invalidate cache
    await this.invalidateCache(params.key);

    return flag;
  }

  /**
   * Update an existing feature flag
   */
  async update(key: string, params: { enabled?: boolean; description?: string; metadata?: Record<string, unknown> }) {
    const data: Record<string, unknown> = {};
    if (params.enabled !== undefined) data.enabled = params.enabled;
    if (params.description !== undefined) data.description = params.description;
    if (params.metadata !== undefined) data.metadata = params.metadata;

    const flag = await prisma.featureFlag.update({
      where: { key },
      data,
    });

    // Invalidate cache
    await this.invalidateCache(key);

    return flag;
  }

  /**
   * Delete a feature flag
   */
  async delete(key: string) {
    const flag = await prisma.featureFlag.delete({
      where: { key },
    });

    // Invalidate cache
    await this.invalidateCache(key);

    return flag;
  }

  /**
   * Get all flags as a Record<string, boolean> map (for client consumption)
   */
  async getClientFlags(): Promise<Record<string, boolean>> {
    const flags = await prisma.featureFlag.findMany({
      select: { key: true, enabled: true },
    });

    const map: Record<string, boolean> = {};
    for (const flag of flags) {
      map[flag.key] = flag.enabled;
    }
    return map;
  }

  /**
   * Invalidate the Redis cache for a specific feature flag key
   */
  private async invalidateCache(key: string) {
    try {
      await redis.del(`${FF_PREFIX}${key}`);
    } catch (err) {
      logger.warn({ err }, 'Failed to invalidate feature flag cache');
    }
  }
}

export const featureFlagService = new FeatureFlagService();
