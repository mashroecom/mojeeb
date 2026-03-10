import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';

const router: Router = Router();

// GET /stats - Security audit statistics (last 30 days)
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Total logins last 30 days
    const totalLogins = await prisma.loginActivity.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    // Failed logins last 30 days
    const failedLogins = await prisma.loginActivity.count({
      where: { createdAt: { gte: thirtyDaysAgo }, success: false },
    });

    // Success rate
    const successRate =
      totalLogins > 0 ? Number((((totalLogins - failedLogins) / totalLogins) * 100).toFixed(1)) : 0;

    // Unique IPs last 30 days
    const uniqueIPsResult = await prisma.loginActivity.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, ipAddress: { not: null } },
      distinct: ['ipAddress'],
      select: { ipAddress: true },
    });
    const uniqueIPs = uniqueIPsResult.length;

    // Suspicious IPs: IPs with > 5 failed logins in 24h
    const recentFailures = await prisma.loginActivity.groupBy({
      by: ['ipAddress'],
      where: {
        createdAt: { gte: twentyFourHoursAgo },
        success: false,
        ipAddress: { not: null },
      },
      _count: { id: true },
      having: { id: { _count: { gt: 5 } } },
    });

    const suspiciousIPs = recentFailures.map((r) => ({
      ip: r.ipAddress,
      failedCount: r._count.id,
    }));

    // Top 10 failed IPs (all time last 30 days)
    const topFailedIPs = await prisma.loginActivity.groupBy({
      by: ['ipAddress'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
        success: false,
        ipAddress: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    res.json({
      success: true,
      data: {
        totalLogins,
        failedLogins,
        successRate,
        uniqueIPs,
        suspiciousIPs,
        topFailedIPs: topFailedIPs.map((r) => ({
          ip: r.ipAddress,
          failedCount: r._count.id,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /recent-failures - Last 50 failed login attempts with pagination
router.get('/recent-failures', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const [failures, total] = await Promise.all([
      prisma.loginActivity.findMany({
        where: { success: false },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          ipAddress: true,
          userAgent: true,
          country: true,
          city: true,
          failReason: true,
          createdAt: true,
        },
      }),
      prisma.loginActivity.count({ where: { success: false } }),
    ]);

    res.json({
      success: true,
      data: {
        failures,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
