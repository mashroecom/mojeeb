import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';

const router: Router = Router();

// GET /stats - Aggregate rating stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [aggregate, distribution, trend] = await Promise.all([
      prisma.conversationRating.aggregate({
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.conversationRating.groupBy({
        by: ['rating'],
        _count: { _all: true },
        orderBy: { rating: 'asc' },
      }),
      // Last 30 days grouped by day
      prisma.$queryRaw<{ date: string; avg: number; count: bigint }[]>`
        SELECT DATE("createdAt") as date,
               AVG(rating) as avg,
               COUNT(*)::int as count
        FROM "conversation_ratings"
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

    const distributionMap: Record<number, number> = {};
    for (let i = 1; i <= 5; i++) distributionMap[i] = 0;
    for (const row of distribution) {
      distributionMap[row.rating] = row._count._all;
    }

    res.json({
      success: true,
      data: {
        average: aggregate._avg.rating ?? 0,
        total: aggregate._count._all,
        distribution: distributionMap,
        trend: trend.map((r) => ({
          date: r.date,
          avg: Number(r.avg),
          count: Number(r.count),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET / - List all ratings with pagination and filters
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const where: Record<string, unknown> = {};
    if (rating && rating >= 1 && rating <= 5) where.rating = rating;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.conversationRating.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          conversation: {
            select: {
              id: true,
              customerName: true,
              channel: { select: { name: true } },
            },
          },
        },
      }),
      prisma.conversationRating.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        data: items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
