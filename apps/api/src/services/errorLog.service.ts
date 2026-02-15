import { prisma } from '../config/database';
import { logger } from '../config/logger';

export class ErrorLogService {
  /**
   * Fire-and-forget DB write for error logging.
   */
  async log(params: {
    level?: string;
    message: string;
    stack?: string;
    source?: string;
    path?: string;
    method?: string;
    userId?: string;
    ipAddress?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await prisma.errorLog.create({
        data: {
          level: params.level ?? 'ERROR',
          message: params.message,
          stack: params.stack,
          source: params.source,
          path: params.path,
          method: params.method,
          userId: params.userId,
          ipAddress: params.ipAddress,
          metadata: (params.metadata as any) ?? undefined,
        },
      });
    } catch (err) {
      // Never let error logging break the app
      logger.warn({ err }, 'Failed to write error log to DB');
    }
  }

  /**
   * List error logs with pagination and filters.
   */
  async list(params: {
    page: number;
    limit: number;
    level?: string;
    source?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const { page, limit, level, source, startDate, endDate, search } = params;
    const where: Record<string, unknown> = {};

    if (level) where.level = level;
    if (source) where.source = source;
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }
    if (search) {
      where.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { path: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        select: {
          id: true,
          level: true,
          message: true,
          source: true,
          path: true,
          method: true,
          userId: true,
          ipAddress: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.errorLog.count({ where }),
    ]);

    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get a single error log with full stack trace.
   */
  async getById(id: string) {
    return prisma.errorLog.findUnique({ where: { id } });
  }

  /**
   * Delete error logs older than a given number of days.
   */
  async cleanup(olderThanDays: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await prisma.errorLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return result.count;
  }
}

export const errorLogService = new ErrorLogService();
