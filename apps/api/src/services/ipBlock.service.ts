import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { loginActivityService } from './loginActivity.service';

const BLOCKED_IP_PREFIX = 'blocked:ip:';
const BLOCKED_IP_TTL = 60; // 60 seconds cache

const AUTO_BLOCK_THRESHOLD = 10; // failures
const AUTO_BLOCK_WINDOW_MINUTES = 15; // time window
const AUTO_BLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export class IPBlockService {
  /**
   * Check if an IP is blocked.
   * Uses Redis cache with 60s TTL, falls back to DB.
   * Auto-deletes expired blocks.
   */
  async isBlocked(ip: string): Promise<boolean> {
    if (!ip) return false;

    const cacheKey = `${BLOCKED_IP_PREFIX}${ip}`;

    try {
      // Check Redis cache first
      const cached = await redis.get(cacheKey);
      if (cached === '1') return true;
      if (cached === '0') return false;
    } catch (err) {
      logger.warn({ err }, 'Redis error checking blocked IP, falling back to DB');
    }

    // Cache miss — check DB
    const record = await prisma.blockedIP.findUnique({
      where: { ip },
    });

    if (!record) {
      // Not blocked — cache the negative result
      try {
        await redis.set(cacheKey, '0', 'EX', BLOCKED_IP_TTL);
      } catch {}
      return false;
    }

    // Check if the block has expired
    if (record.expiresAt && record.expiresAt < new Date()) {
      // Auto-delete expired block
      await prisma.blockedIP.delete({ where: { id: record.id } }).catch(() => {});
      try {
        await redis.set(cacheKey, '0', 'EX', BLOCKED_IP_TTL);
      } catch {}
      return false;
    }

    // Blocked — cache the positive result
    try {
      await redis.set(cacheKey, '1', 'EX', BLOCKED_IP_TTL);
    } catch {}
    return true;
  }

  /**
   * Block an IP address
   */
  async block(params: {
    ip: string;
    reason: string;
    blockedBy: string;
    expiresAt?: Date;
    autoBlock?: boolean;
  }) {
    const record = await prisma.blockedIP.create({
      data: {
        ip: params.ip,
        reason: params.reason,
        blockedBy: params.blockedBy,
        expiresAt: params.expiresAt,
        autoBlock: params.autoBlock ?? false,
      },
    });

    // Set Redis cache
    try {
      const cacheKey = `${BLOCKED_IP_PREFIX}${params.ip}`;
      if (params.expiresAt) {
        const ttl = Math.max(1, Math.floor((params.expiresAt.getTime() - Date.now()) / 1000));
        await redis.set(cacheKey, '1', 'EX', ttl);
      } else {
        await redis.set(cacheKey, '1', 'EX', BLOCKED_IP_TTL);
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to set blocked IP in Redis');
    }

    return record;
  }

  /**
   * Unblock an IP by record ID
   */
  async unblock(id: string) {
    const record = await prisma.blockedIP.findUnique({ where: { id } });
    if (!record) return null;

    await prisma.blockedIP.delete({ where: { id } });

    // Clear Redis cache
    try {
      await redis.del(`${BLOCKED_IP_PREFIX}${record.ip}`);
    } catch (err) {
      logger.warn({ err }, 'Failed to clear blocked IP from Redis');
    }

    return record;
  }

  /**
   * Paginated list of blocked IPs
   */
  async list(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { ip: { contains: search } },
        { reason: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.blockedIP.findMany({
        where,
        include: {
          blocker: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.blockedIP.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Auto-block check: if an IP has too many failed login attempts, block it.
   * Threshold: 10 failures in 15 minutes -> auto-block for 24 hours.
   */
  async autoBlockCheck(ip: string, userId: string) {
    if (!ip) return;

    try {
      // Check if already blocked
      const alreadyBlocked = await prisma.blockedIP.findUnique({ where: { ip } });
      if (alreadyBlocked) return;

      const failedCount = await loginActivityService.getFailedCountByIP(ip, AUTO_BLOCK_WINDOW_MINUTES);

      if (failedCount >= AUTO_BLOCK_THRESHOLD) {
        await this.block({
          ip,
          reason: `Auto-blocked: ${failedCount} failed login attempts in ${AUTO_BLOCK_WINDOW_MINUTES} minutes`,
          blockedBy: userId,
          expiresAt: new Date(Date.now() + AUTO_BLOCK_DURATION_MS),
          autoBlock: true,
        });
        logger.warn({ ip, failedCount }, 'IP auto-blocked due to excessive failed login attempts');
      }
    } catch (err) {
      logger.warn({ err, ip }, 'Failed to run auto-block check');
    }
  }
}

export const ipBlockService = new IPBlockService();
