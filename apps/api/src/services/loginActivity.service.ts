import { prisma } from '../config/database';
import { logger } from '../config/logger';

export class LoginActivityService {
  /**
   * Log a login attempt (fire-and-forget — caller should .catch(() => {}))
   */
  async log(params: {
    userId?: string;
    email: string;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
    failReason?: string;
  }) {
    try {
      await prisma.loginActivity.create({
        data: {
          userId: params.userId,
          email: params.email.toLowerCase(),
          success: params.success,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          failReason: params.failReason,
        },
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to log login activity');
    }
  }

  /**
   * Paginated list of login activity with optional filters
   */
  async list(params: {
    page: number;
    limit: number;
    userId?: string;
    email?: string;
    success?: boolean;
    ipAddress?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, limit, userId, email, success, ipAddress, startDate, endDate } = params;
    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (email) where.email = { contains: email.toLowerCase(), mode: 'insensitive' };
    if (success !== undefined) where.success = success;
    if (ipAddress) where.ipAddress = ipAddress;
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      prisma.loginActivity.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.loginActivity.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Count failed login attempts from an IP within a time window
   */
  async getFailedCountByIP(ip: string, windowMinutes: number): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    return prisma.loginActivity.count({
      where: {
        ipAddress: ip,
        success: false,
        createdAt: { gte: since },
      },
    });
  }

  /**
   * Get today's login stats summary
   */
  async getStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayFilter = { createdAt: { gte: todayStart } };

    const [totalLogins, failedLogins, uniqueIPsResult] = await Promise.all([
      prisma.loginActivity.count({ where: todayFilter }),
      prisma.loginActivity.count({ where: { ...todayFilter, success: false } }),
      prisma.loginActivity.groupBy({
        by: ['ipAddress'],
        where: todayFilter,
      }),
    ]);

    return {
      totalLogins,
      failedLogins,
      successfulLogins: totalLogins - failedLogins,
      uniqueIPs: uniqueIPsResult.length,
    };
  }
}

export const loginActivityService = new LoginActivityService();
