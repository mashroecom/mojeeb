import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

const REDIS_PREFIX = 'config:';
const REDIS_TTL = 3600; // 1 hour

const VALID_CATEGORIES = ['ai', 'payment', 'email', 'meta', 'oauth', 'general', 'security', 'notifications', 'org_defaults', 'token_pricing'] as const;
type ConfigCategory = (typeof VALID_CATEGORIES)[number];

export class ConfigService {
  async warmCache(): Promise<void> {
    try {
      const configs = await prisma.systemConfig.findMany();
      const pipeline = redis.pipeline();
      for (const cfg of configs) {
        pipeline.setex(`${REDIS_PREFIX}${cfg.key}`, REDIS_TTL, cfg.value);
      }
      await pipeline.exec();
      logger.info(`Config cache warmed with ${configs.length} keys`);
    } catch (err) {
      logger.warn({ err }, 'Failed to warm config cache');
    }
  }

  async get(key: string): Promise<string> {
    // Try Redis first
    try {
      const cached = await redis.get(`${REDIS_PREFIX}${key}`);
      if (cached !== null) return cached;
    } catch (err) {
      logger.debug({ err }, 'Redis config read failed');
    }

    // Try DB
    const record = await prisma.systemConfig.findUnique({ where: { key } });
    if (record) {
      try {
        await redis.setex(`${REDIS_PREFIX}${key}`, REDIS_TTL, record.value);
      } catch {
        // ignore write-back failure
      }
      return record.value;
    }

    // Fall back to process.env
    return process.env[key] || '';
  }

  async set(key: string, value: string): Promise<void> {
    await prisma.systemConfig.update({
      where: { key },
      data: { value },
    });

    try {
      await redis.setex(`${REDIS_PREFIX}${key}`, REDIS_TTL, value);
    } catch (err) {
      logger.debug({ err }, 'Redis config write failed');
    }
  }

  async getByCategory(category: ConfigCategory) {
    const configs = await prisma.systemConfig.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    return configs;
  }

  maskValue(value: string, isSecret: boolean): string {
    if (!isSecret) {
      return value;
    }
    if (!value || value.length === 0) {
      return '';
    }
    if (value.length <= 8) {
      return '***';
    }
    return `${value.substring(0, 4)}***${value.substring(value.length - 4)}`;
  }

  async clearCache(): Promise<void> {
    try {
      const keys = await redis.keys(`${REDIS_PREFIX}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      logger.debug('Config cache cleared');
    } catch (err) {
      logger.debug({ err }, 'Failed to clear config cache');
    }
  }
}

export const configService = new ConfigService();
