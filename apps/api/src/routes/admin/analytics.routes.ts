import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { adminService } from '../../services/admin.service';
import { prisma } from '../../config/database';
import { validate } from '../../middleware/validate';

const growthQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
});

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const sparklineSchema = z.object({
  metric: z.enum(['users', 'subscriptions', 'revenue', 'conversations', 'tokens']),
});

const signupsSchema = z.object({
  groupBy: z.enum(['day', 'week', 'month']).optional().default('day'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const router: Router = Router();

// GET /overview - Platform overview
router.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adminService.getPlatformOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /growth - Growth metrics
router.get('/growth', validate({ query: growthQuerySchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const groupBy = req.query.groupBy as string | undefined;

    const data = await adminService.getPlatformGrowth({ startDate, endDate, groupBy });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /revenue - Revenue analytics
router.get('/revenue', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adminService.getRevenueAnalytics();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /top-organizations - Top organizations by message count
router.get('/top-organizations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
    const data = await adminService.getTopOrganizations(limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /recent-activity - Recent platform activity
router.get('/recent-activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;
    const data = await adminService.getRecentActivity(limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /daily-revenue - Revenue over last 30 days
router.get('/daily-revenue', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adminService.getDailyRevenue();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /dashboard-overview - 8 metrics with period comparison
router.get('/dashboard-overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      currentUsers, previousUsers,
      currentActiveSubs, previousActiveSubs,
      currentRevenue, previousRevenue,
      currentConversations, previousConversations,
      currentTokens, previousTokens,
      currentCost, previousCost,
      activeUsersToday,
      currentMessages, previousMessages,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: currentStart, lte: now } } }),
      prisma.user.count({ where: { createdAt: { gte: previousStart, lte: currentStart } } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', plan: { not: 'FREE' }, createdAt: { lte: now } } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', plan: { not: 'FREE' }, createdAt: { lte: currentStart } } }),
      prisma.invoice.aggregate({ where: { status: 'PAID', paidAt: { gte: currentStart, lte: now } }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { status: 'PAID', paidAt: { gte: previousStart, lte: currentStart } }, _sum: { amount: true } }),
      prisma.conversation.count({ where: { createdAt: { gte: currentStart, lte: now } } }),
      prisma.conversation.count({ where: { createdAt: { gte: previousStart, lte: currentStart } } }),
      prisma.tokenUsage.aggregate({ where: { createdAt: { gte: currentStart, lte: now } }, _sum: { totalTokens: true } }),
      prisma.tokenUsage.aggregate({ where: { createdAt: { gte: previousStart, lte: currentStart } }, _sum: { totalTokens: true } }),
      prisma.tokenUsage.aggregate({ where: { createdAt: { gte: currentStart, lte: now } }, _sum: { costUsd: true } }),
      prisma.tokenUsage.aggregate({ where: { createdAt: { gte: previousStart, lte: currentStart } }, _sum: { costUsd: true } }),
      prisma.user.count({ where: { lastLoginAt: { gte: todayStart } } }),
      prisma.message.count({ where: { createdAt: { gte: currentStart, lte: now } } }),
      prisma.message.count({ where: { createdAt: { gte: previousStart, lte: currentStart } } }),
    ]);

    function changePercent(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 10000) / 100;
    }

    const mrrCurrent = currentRevenue._sum.amount?.toNumber() || 0;
    const mrrPrevious = previousRevenue._sum.amount?.toNumber() || 0;
    const tokensCurrent = currentTokens._sum.totalTokens || 0;
    const tokensPrevious = previousTokens._sum.totalTokens || 0;
    const costCurrent = currentCost._sum.costUsd?.toNumber() || 0;
    const costPrevious = previousCost._sum.costUsd?.toNumber() || 0;

    const metrics = [
      { label: 'totalUsers', value: currentUsers, previousValue: previousUsers, changePercent: changePercent(currentUsers, previousUsers) },
      { label: 'activeSubscriptions', value: currentActiveSubs, previousValue: previousActiveSubs, changePercent: changePercent(currentActiveSubs, previousActiveSubs) },
      { label: 'monthlyRevenue', value: mrrCurrent, previousValue: mrrPrevious, changePercent: changePercent(mrrCurrent, mrrPrevious) },
      { label: 'totalConversations', value: currentConversations, previousValue: previousConversations, changePercent: changePercent(currentConversations, previousConversations) },
      { label: 'totalTokensUsed', value: tokensCurrent, previousValue: tokensPrevious, changePercent: changePercent(tokensCurrent, tokensPrevious) },
      { label: 'totalCost', value: costCurrent, previousValue: costPrevious, changePercent: changePercent(costCurrent, costPrevious) },
      { label: 'activeUsersToday', value: activeUsersToday, previousValue: 0, changePercent: 0 },
      { label: 'totalMessages', value: currentMessages, previousValue: previousMessages, changePercent: changePercent(currentMessages, previousMessages) },
    ];

    res.json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
});

// GET /sparkline - 7 daily data points for sparkline charts
router.get('/sparkline', validate({ query: sparklineSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metric = req.query.metric as string;
    const points: { date: string; value: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const dateStr = dayStart.toISOString().split('T')[0]!;

      let value = 0;
      switch (metric) {
        case 'users':
          value = await prisma.user.count({ where: { createdAt: { gte: dayStart, lte: dayEnd } } });
          break;
        case 'subscriptions':
          value = await prisma.subscription.count({ where: { createdAt: { gte: dayStart, lte: dayEnd }, status: 'ACTIVE', plan: { not: 'FREE' } } });
          break;
        case 'revenue': {
          const rev = await prisma.invoice.aggregate({ where: { status: 'PAID', paidAt: { gte: dayStart, lte: dayEnd } }, _sum: { amount: true } });
          value = rev._sum.amount?.toNumber() || 0;
          break;
        }
        case 'conversations':
          value = await prisma.conversation.count({ where: { createdAt: { gte: dayStart, lte: dayEnd } } });
          break;
        case 'tokens': {
          const tok = await prisma.tokenUsage.aggregate({ where: { createdAt: { gte: dayStart, lte: dayEnd } }, _sum: { totalTokens: true } });
          value = tok._sum.totalTokens || 0;
          break;
        }
      }
      points.push({ date: dateStr, value });
    }

    res.json({ success: true, data: points });
  } catch (err) {
    next(err);
  }
});

// GET /signups-over-time - User signups time series
router.get('/signups-over-time', validate({ query: signupsSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupBy = (req.query.groupBy as string) || 'day';
    const start = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    const trunc = `date_trunc('${groupBy}', "createdAt")`;
    const rows = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT ${Prisma.raw(trunc)} AS "date", COUNT(*)::bigint AS "count"
        FROM "users"
       WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
       GROUP BY 1 ORDER BY 1
    `;

    res.json({ success: true, data: rows.map((r) => ({ date: r.date, count: Number(r.count) })) });
  } catch (err) {
    next(err);
  }
});

// GET /revenue-over-time - MRR time series from paid invoices
router.get('/revenue-over-time', validate({ query: dateRangeSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const start = new Date(req.query.startDate as string);
    const end = new Date(req.query.endDate as string);

    const rows = await prisma.$queryRaw<{ date: Date; revenue: number }[]>`
      SELECT date_trunc('day', "paidAt") AS "date",
             SUM("amount")::float AS "revenue"
        FROM "invoices"
       WHERE "status" = 'PAID'
         AND "paidAt" >= ${start} AND "paidAt" <= ${end}
       GROUP BY 1 ORDER BY 1
    `;

    res.json({ success: true, data: rows.map((r) => ({ date: r.date, revenue: r.revenue })) });
  } catch (err) {
    next(err);
  }
});

// GET /subscriptions-by-plan - Count per plan for donut chart
router.get('/subscriptions-by-plan', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.subscription.groupBy({
      by: ['plan'],
      where: { status: 'ACTIVE' },
      _count: { _all: true },
    });

    res.json({ success: true, data: data.map((r) => ({ plan: r.plan, count: r._count._all })) });
  } catch (err) {
    next(err);
  }
});

// GET /token-usage-over-time - Daily token usage (input vs output)
router.get('/token-usage-over-time', validate({ query: dateRangeSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const start = new Date(req.query.startDate as string);
    const end = new Date(req.query.endDate as string);

    const rows = await prisma.$queryRaw<
      { date: Date; inputTokens: bigint; outputTokens: bigint; totalTokens: bigint }[]
    >`
      SELECT date_trunc('day', "createdAt") AS "date",
             SUM("inputTokens")::bigint AS "inputTokens",
             SUM("outputTokens")::bigint AS "outputTokens",
             SUM("totalTokens")::bigint AS "totalTokens"
        FROM "token_usages"
       WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
       GROUP BY 1 ORDER BY 1
    `;

    res.json({
      success: true,
      data: rows.map((r) => ({
        date: r.date,
        inputTokens: Number(r.inputTokens),
        outputTokens: Number(r.outputTokens),
        totalTokens: Number(r.totalTokens),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /top-users-by-usage - Top users with plan, messages, tokens, cost
router.get('/top-users-by-usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));

    const rows = await prisma.$queryRaw<
      { userId: string; firstName: string; lastName: string; email: string; plan: string; messageCount: bigint; totalTokens: bigint; totalCost: number }[]
    >`
      SELECT u."id" AS "userId",
             u."firstName",
             u."lastName",
             u."email",
             COALESCE(s."plan", 'FREE') AS "plan",
             COUNT(DISTINCT m."id")::bigint AS "messageCount",
             COALESCE(SUM(tu."totalTokens"), 0)::bigint AS "totalTokens",
             COALESCE(SUM(tu."costUsd"), 0)::float AS "totalCost"
        FROM "users" u
        LEFT JOIN "org_memberships" om ON om."userId" = u."id"
        LEFT JOIN "subscriptions" s ON s."orgId" = om."orgId"
        LEFT JOIN "conversations" c ON c."orgId" = om."orgId"
        LEFT JOIN "messages" m ON m."conversationId" = c."id"
        LEFT JOIN "token_usages" tu ON tu."orgId" = om."orgId"
       GROUP BY u."id", u."firstName", u."lastName", u."email", s."plan"
       ORDER BY "totalTokens" DESC
       LIMIT ${limit}
    `;

    res.json({
      success: true,
      data: rows.map((r) => ({
        userId: r.userId,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        plan: r.plan,
        totalMessages: Number(r.messageCount),
        totalTokens: Number(r.totalTokens),
        totalCost: r.totalCost,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /platform-activity-heatmap - Messages by hour and day of week for last 30 days
router.get('/platform-activity-heatmap', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows = await prisma.$queryRaw<
      { dayOfWeek: number; hour: number; count: bigint }[]
    >`
      SELECT EXTRACT(DOW FROM "createdAt")::int AS "dayOfWeek",
             EXTRACT(HOUR FROM "createdAt")::int AS "hour",
             COUNT(*)::bigint AS "count"
        FROM "messages"
       WHERE "createdAt" >= ${thirtyDaysAgo}
       GROUP BY 1, 2
       ORDER BY 1, 2
    `;

    res.json({
      success: true,
      data: rows.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        hour: r.hour,
        count: Number(r.count),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /recent-events - Recent platform events (signups, upgrades, payments, errors)
router.get('/recent-events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const [recentUsers, recentInvoices, recentErrors] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, firstName: true, lastName: true, email: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.invoice.findMany({
        where: { status: 'PAID' },
        select: { id: true, amount: true, currency: true, paidAt: true, subscription: { select: { org: { select: { name: true } } } } },
        orderBy: { paidAt: 'desc' },
        take: limit,
      }),
      prisma.errorLog.findMany({
        select: { id: true, message: true, level: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const events: Array<{ type: string; id: string; description: string; timestamp: Date }> = [];

    for (const u of recentUsers) {
      events.push({
        type: 'signup',
        id: u.id,
        description: `${u.firstName} ${u.lastName} (${u.email}) signed up`,
        timestamp: u.createdAt,
      });
    }

    for (const inv of recentInvoices) {
      events.push({
        type: 'payment',
        id: inv.id,
        description: `${inv.subscription?.org?.name || 'Unknown'} paid ${inv.currency} ${inv.amount}`,
        timestamp: inv.paidAt || inv.paidAt!,
      });
    }

    for (const err of recentErrors) {
      events.push({
        type: 'error',
        id: err.id,
        description: `[${err.level}] ${err.message}`,
        timestamp: err.createdAt,
      });
    }

    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    res.json({ success: true, data: events.slice(0, limit) });
  } catch (err) {
    next(err);
  }
});

export default router;
