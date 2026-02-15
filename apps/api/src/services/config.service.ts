import { prisma } from '../config/database';
import { logger } from '../config/logger';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const VALID_CATEGORIES = ['ai', 'payment', 'email', 'meta', 'oauth', 'general', 'security', 'notifications', 'org_defaults', 'token_pricing'] as const;
type ConfigCategory = (typeof VALID_CATEGORIES)[number];

export class ConfigService {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * Load all configs for a given category into cache.
   */
  async loadCategory(category: ConfigCategory): Promise<void> {
    const configs = await prisma.systemConfig.findMany({
      where: { category },
    });

    const now = Date.now();
    for (const cfg of configs) {
      this.cache.set(cfg.key, {
        value: cfg.value,
        expiresAt: now + CACHE_TTL_MS,
      });
    }
  }

  /**
   * Get a single config value by key.
   * Falls back: cache -> DB -> process.env
   */
  async get(key: string): Promise<string> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Try DB
    const record = await prisma.systemConfig.findUnique({ where: { key } });
    if (record) {
      this.cache.set(key, {
        value: record.value,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return record.value;
    }

    // Fall back to process.env
    return process.env[key] || '';
  }

  /**
   * Set a config value in the database and update cache.
   */
  async set(key: string, value: string): Promise<void> {
    await prisma.systemConfig.update({
      where: { key },
      data: { value },
    });

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  /**
   * Get all configs for a category from the database.
   */
  async getByCategory(category: ConfigCategory) {
    const configs = await prisma.systemConfig.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    return configs;
  }

  /**
   * Mask a config value for display.
   * Shows first 4 + last 4 chars with *** in between.
   * Returns empty string if value is empty.
   */
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

  /**
   * Clear all cached values.
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Config cache cleared');
  }
}

export const configService = new ConfigService();
