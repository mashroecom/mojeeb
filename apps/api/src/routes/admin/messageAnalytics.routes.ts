import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';

const router: Router = Router();

// GET /stats - Message performance stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [aggregate, byProvider, byStatus] = await Promise.all([
      prisma.message.aggregate({
        _avg: { latencyMs: true, tokenCount: true },
        _sum: { tokenCount: true },
        _count: { _all: true },
      }),
      prisma.message.groupBy({
        by: ['aiProvider'],
        where: { aiProvider: { not: null } },
        _count: { _all: true },
        _avg: { latencyMs: true, tokenCount: true },
      }),
      prisma.message.groupBy({
        by: ['deliveryStatus'],
        _count: { _all: true },
      }),
    ]);

    const deliveryStatusBreakdown: Record<string, number> = {};
    for (const row of byStatus) {
      deliveryStatusBreakdown[row.deliveryStatus] = row._count._all;
    }

    const messagesByProvider: Record<
      string,
      { count: number; avgLatency: number; avgTokens: number }
    > = {};
    for (const row of byProvider) {
      if (row.aiProvider) {
        messagesByProvider[row.aiProvider] = {
          count: row._count._all,
          avgLatency: Math.round(row._avg.latencyMs ?? 0),
          avgTokens: Math.round(row._avg.tokenCount ?? 0),
        };
      }
    }

    res.json({
      success: true,
      data: {
        avgLatency: Math.round(aggregate._avg.latencyMs ?? 0),
        totalTokens: aggregate._sum.tokenCount ?? 0,
        totalMessages: aggregate._count._all,
        avgTokensPerMessage: Math.round(aggregate._avg.tokenCount ?? 0),
        messagesByProvider,
        deliveryStatusBreakdown,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /trends - Last 30 days daily message trends
router.get('/trends', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const trends = await prisma.$queryRaw<
      { date: string; count: number; avgLatency: number; totalTokens: number }[]
    >`
      SELECT DATE("createdAt") as date,
             COUNT(*)::int as count,
             COALESCE(AVG("latencyMs"), 0)::int as "avgLatency",
             COALESCE(SUM("tokenCount"), 0)::int as "totalTokens"
      FROM "messages"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    res.json({
      success: true,
      data: trends.map((r) => ({
        date: r.date,
        count: Number(r.count),
        avgLatency: Number(r.avgLatency),
        totalTokens: Number(r.totalTokens),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
