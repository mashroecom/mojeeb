import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { LeadStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { validate } from '../../middleware/validate';

const router: Router = Router();

const DAY_MS = 24 * 60 * 60 * 1000;
/** Lead.confidence is the AI extraction confidence in [0, 1] */
const HIGH_VALUE_CONFIDENCE = 0.8;
const TREND_DAYS = 30;
const BREAKDOWN_LIMIT = 8;

// Pipeline order used by the funnel
const FUNNEL_ORDER: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.CONVERTED,
  LeadStatus.LOST,
];

const topLeadsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

function percent(part: number, whole: number): number {
  return whole > 0 ? Number(((part / whole) * 100).toFixed(1)) : 0;
}

// GET /stats - Platform-wide lead generation and conversion metrics
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const todayUtc = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const trendStart = new Date(todayUtc.getTime() - (TREND_DAYS - 1) * DAY_MS);

    const [
      aggregate,
      highValueLeads,
      byStatus,
      bySource,
      byBudget,
      trendRows,
      totalActivities,
      leadsWithActivity,
      topActions,
    ] = await Promise.all([
      prisma.lead.aggregate({ _count: { _all: true }, _avg: { confidence: true } }),
      prisma.lead.count({ where: { confidence: { gte: HIGH_VALUE_CONFIDENCE } } }),
      prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.lead.groupBy({
        by: ['source'],
        _count: { _all: true },
        orderBy: { _count: { source: 'desc' } },
      }),
      prisma.lead.groupBy({
        by: ['budget'],
        _count: { _all: true },
        orderBy: { _count: { budget: 'desc' } },
      }),
      prisma.$queryRaw<{ date: Date; count: number }[]>`
        SELECT date_trunc('day', "createdAt") AS "date", COUNT(*)::int AS "count"
          FROM "leads"
         WHERE "createdAt" >= ${trendStart}
         GROUP BY 1
         ORDER BY 1
      `,
      prisma.leadActivity.count(),
      prisma.lead.count({ where: { activities: { some: {} } } }),
      prisma.leadActivity.groupBy({
        by: ['action'],
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
        take: BREAKDOWN_LIMIT,
      }),
    ]);

    const totalLeads = aggregate._count._all;
    const statusCounts = new Map(byStatus.map((row) => [row.status, row._count._all]));
    const convertedLeads = statusCounts.get(LeadStatus.CONVERTED) ?? 0;

    // groupBy orders NULL groups inconsistently, so sort the (small) result in memory.
    const sortByCount = <T extends { count: number }>(rows: T[]) =>
      [...rows].sort((a, b) => b.count - a.count);

    const sources = sortByCount(
      bySource.map((row) => ({ source: row.source, count: row._count._all })),
    );

    // Budget is free text extracted from conversations: keep the most common values and
    // fold the long tail into one "other" bucket so the totals still add up.
    const budgets = sortByCount(
      byBudget
        .map((row) => ({ budget: row.budget?.trim() || null, count: row._count._all }))
        .reduce<{ budget: string | null; count: number }[]>((acc, row) => {
          const existing = acc.find((item) => item.budget === row.budget);
          if (existing) existing.count += row.count;
          else acc.push({ ...row });
          return acc;
        }, []),
    );
    const specifiedBudgets = budgets.filter((row) => row.budget !== null);
    const topBudgets = specifiedBudgets.slice(0, BREAKDOWN_LIMIT);
    const otherBudgetCount = specifiedBudgets
      .slice(BREAKDOWN_LIMIT)
      .reduce((sum, row) => sum + row.count, 0);
    const unspecifiedBudgetCount = budgets.find((row) => row.budget === null)?.count ?? 0;

    const trendByDate = new Map(
      trendRows.map((row) => [row.date.toISOString().slice(0, 10), row.count]),
    );
    const leadsOverTime = Array.from({ length: TREND_DAYS }, (_, i) => {
      const date = new Date(trendStart.getTime() + i * DAY_MS).toISOString().slice(0, 10);
      return { date, count: trendByDate.get(date) ?? 0 };
    });

    res.json({
      success: true,
      data: {
        totalLeads,
        convertedLeads,
        // Percentage (0-100) of all leads whose status is CONVERTED
        conversionRate: percent(convertedLeads, totalLeads),
        // Mean AI confidence in [0, 1]; null when there are no leads
        avgConfidence:
          aggregate._avg.confidence === null ? null : Number(aggregate._avg.confidence.toFixed(4)),
        highValueLeads,
        highValueThreshold: HIGH_VALUE_CONFIDENCE,
        newLeadsLast30Days: leadsOverTime.reduce((sum, day) => sum + day.count, 0),
        statusFunnel: FUNNEL_ORDER.map((status) => {
          const count = statusCounts.get(status) ?? 0;
          return { status, count, percentage: percent(count, totalLeads) };
        }),
        bySource: sources.map((row) => ({
          ...row,
          percentage: percent(row.count, totalLeads),
        })),
        budgetDistribution: {
          items: topBudgets,
          otherCount: otherBudgetCount,
          unspecifiedCount: unspecifiedBudgetCount,
        },
        leadsOverTime,
        activities: {
          total: totalActivities,
          leadsWithActivity,
          topActions: topActions.map((row) => ({ action: row.action, count: row._count._all })),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /top-leads - Leads with the highest AI confidence across all organizations
router.get(
  '/top-leads',
  validate({ query: topLeadsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit } = req.query as unknown as z.infer<typeof topLeadsSchema>;

      const leads = await prisma.lead.findMany({
        orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
          confidence: true,
          budget: true,
          timeline: true,
          source: true,
          status: true,
          createdAt: true,
          org: { select: { id: true, name: true } },
          _count: { select: { activities: true } },
        },
      });

      res.json({
        success: true,
        data: leads.map(({ org, _count, ...lead }) => ({
          ...lead,
          orgId: org.id,
          orgName: org.name,
          activityCount: _count.activities,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
