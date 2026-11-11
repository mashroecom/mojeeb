import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { validate } from '../../middleware/validate';
import { BadRequestError } from '../../utils/errors';

const router: Router = Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;

// ─── Query schemas ────────────────────────────────────────────────

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Invalid calendar date');

const rangeFields = {
  startDate: isoDay.optional(),
  endDate: isoDay.optional(),
};

const rangeSchema = z.object(rangeFields);

const byOrgSchema = z.object({
  ...rangeFields,
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

const topConsumersSchema = z.object({
  ...rangeFields,
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
});

// ─── Helpers ──────────────────────────────────────────────────────

interface ResolvedRange {
  /** Inclusive lower bound (UTC midnight of startDate) */
  start: Date;
  /** Exclusive upper bound (UTC midnight of the day after endDate) */
  endExclusive: Date;
  startDate: string;
  endDate: string;
  days: number;
}

/**
 * Resolve the optional startDate/endDate query params into a concrete UTC day range.
 * Both bounds are inclusive calendar days; with no params the last 30 days are used.
 */
function resolveRange(query: { startDate?: string; endDate?: string }): ResolvedRange {
  const todayUtc = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const endDay = query.endDate ? new Date(`${query.endDate}T00:00:00.000Z`) : todayUtc;
  const startDay = query.startDate
    ? new Date(`${query.startDate}T00:00:00.000Z`)
    : new Date(endDay.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);

  if (startDay.getTime() > endDay.getTime()) {
    throw new BadRequestError('startDate must be on or before endDate', 'VALIDATION_ERROR');
  }
  const days = Math.round((endDay.getTime() - startDay.getTime()) / DAY_MS) + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestError(
      `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
      'VALIDATION_ERROR',
    );
  }

  return {
    start: startDay,
    endExclusive: new Date(endDay.getTime() + DAY_MS),
    startDate: startDay.toISOString().slice(0, 10),
    endDate: endDay.toISOString().slice(0, 10),
    days,
  };
}

function rangeWhere(range: ResolvedRange): Prisma.TokenUsageWhereInput {
  return { createdAt: { gte: range.start, lt: range.endExclusive } };
}

function toCost(value: Prisma.Decimal | null | undefined): number {
  return value ? Number(value.toNumber().toFixed(6)) : 0;
}

function share(part: number, whole: number): number {
  return whole > 0 ? Number(((part / whole) * 100).toFixed(2)) : 0;
}

async function orgNameMap(orgIds: string[]): Promise<Map<string, string>> {
  if (orgIds.length === 0) return new Map();
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true },
  });
  return new Map(orgs.map((org) => [org.id, org.name]));
}

// ─── Routes ───────────────────────────────────────────────────────

// GET /summary - Platform-wide totals for the selected range
router.get(
  '/summary',
  validate({ query: rangeSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const range = resolveRange(req.query as z.infer<typeof rangeSchema>);
      const where = rangeWhere(range);

      const [totals, perOrg] = await Promise.all([
        prisma.tokenUsage.aggregate({
          where,
          _sum: { inputTokens: true, outputTokens: true, totalTokens: true, costUsd: true },
          _count: { _all: true },
        }),
        prisma.tokenUsage.groupBy({
          by: ['orgId'],
          where,
          _sum: { totalTokens: true, costUsd: true },
          orderBy: { _sum: { totalTokens: 'desc' } },
        }),
      ]);

      const totalTokens = totals._sum.totalTokens ?? 0;
      const totalCost = toCost(totals._sum.costUsd);
      const activeOrgs = perOrg.length;
      const top = perOrg[0];
      const names = top ? await orgNameMap([top.orgId]) : new Map<string, string>();

      res.json({
        success: true,
        data: {
          startDate: range.startDate,
          endDate: range.endDate,
          totalTokens,
          inputTokens: totals._sum.inputTokens ?? 0,
          outputTokens: totals._sum.outputTokens ?? 0,
          totalCost,
          requestCount: totals._count._all,
          activeOrgs,
          avgTokensPerOrg: activeOrgs > 0 ? Math.round(totalTokens / activeOrgs) : 0,
          avgCostPerOrg: activeOrgs > 0 ? Number((totalCost / activeOrgs).toFixed(6)) : 0,
          topConsumer: top
            ? {
                orgId: top.orgId,
                orgName: names.get(top.orgId) ?? null,
                totalTokens: top._sum.totalTokens ?? 0,
                totalCost: toCost(top._sum.costUsd),
                share: share(top._sum.totalTokens ?? 0, totalTokens),
              }
            : null,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /by-day - Daily usage (UTC days), zero-filled across the range
router.get(
  '/by-day',
  validate({ query: rangeSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const range = resolveRange(req.query as z.infer<typeof rangeSchema>);

      const rows = await prisma.$queryRaw<
        {
          date: Date;
          inputTokens: bigint;
          outputTokens: bigint;
          totalTokens: bigint;
          cost: number;
          requests: number;
        }[]
      >`
        SELECT date_trunc('day', "createdAt") AS "date",
               COALESCE(SUM("inputTokens"), 0)::bigint AS "inputTokens",
               COALESCE(SUM("outputTokens"), 0)::bigint AS "outputTokens",
               COALESCE(SUM("totalTokens"), 0)::bigint AS "totalTokens",
               COALESCE(SUM("costUsd"), 0)::float8 AS "cost",
               COUNT(*)::int AS "requests"
          FROM "token_usages"
         WHERE "createdAt" >= ${range.start} AND "createdAt" < ${range.endExclusive}
         GROUP BY 1
         ORDER BY 1
      `;

      const byDate = new Map(rows.map((row) => [row.date.toISOString().slice(0, 10), row]));
      const data = Array.from({ length: range.days }, (_, i) => {
        const date = new Date(range.start.getTime() + i * DAY_MS).toISOString().slice(0, 10);
        const row = byDate.get(date);
        return {
          date,
          inputTokens: row ? Number(row.inputTokens) : 0,
          outputTokens: row ? Number(row.outputTokens) : 0,
          totalTokens: row ? Number(row.totalTokens) : 0,
          cost: row ? Number(row.cost.toFixed(6)) : 0,
          requests: row ? row.requests : 0,
        };
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// GET /by-model - Usage grouped by model + provider
router.get(
  '/by-model',
  validate({ query: rangeSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const range = resolveRange(req.query as z.infer<typeof rangeSchema>);

      const groups = await prisma.tokenUsage.groupBy({
        by: ['model', 'provider'],
        where: rangeWhere(range),
        _sum: { inputTokens: true, outputTokens: true, totalTokens: true, costUsd: true },
        _count: { _all: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
      });

      const grandTotal = groups.reduce((sum, g) => sum + (g._sum.totalTokens ?? 0), 0);

      res.json({
        success: true,
        data: groups.map((g) => ({
          model: g.model,
          provider: g.provider,
          inputTokens: g._sum.inputTokens ?? 0,
          outputTokens: g._sum.outputTokens ?? 0,
          totalTokens: g._sum.totalTokens ?? 0,
          cost: toCost(g._sum.costUsd),
          requests: g._count._all,
          share: share(g._sum.totalTokens ?? 0, grandTotal),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /by-org - Paginated usage per organization, highest consumers first
router.get(
  '/by-org',
  validate({ query: byOrgSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as z.infer<typeof byOrgSchema>;
      const range = resolveRange(query);
      const { page, limit } = query;

      const [groups, totalRows] = await Promise.all([
        prisma.tokenUsage.groupBy({
          by: ['orgId'],
          where: rangeWhere(range),
          _sum: { inputTokens: true, outputTokens: true, totalTokens: true, costUsd: true },
          _count: { _all: true },
          orderBy: [{ _sum: { totalTokens: 'desc' } }, { orgId: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.$queryRaw<{ count: number }[]>`
          SELECT COUNT(DISTINCT "orgId")::int AS "count"
            FROM "token_usages"
           WHERE "createdAt" >= ${range.start} AND "createdAt" < ${range.endExclusive}
        `,
      ]);

      const total = totalRows[0]?.count ?? 0;
      const names = await orgNameMap(groups.map((g) => g.orgId));

      res.json({
        success: true,
        data: {
          data: groups.map((g) => ({
            orgId: g.orgId,
            orgName: names.get(g.orgId) ?? null,
            inputTokens: g._sum.inputTokens ?? 0,
            outputTokens: g._sum.outputTokens ?? 0,
            totalTokens: g._sum.totalTokens ?? 0,
            cost: toCost(g._sum.costUsd),
            requests: g._count._all,
          })),
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
  },
);

// GET /top-consumers - Top N organizations by total tokens, with share of platform usage
router.get(
  '/top-consumers',
  validate({ query: topConsumersSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as z.infer<typeof topConsumersSchema>;
      const range = resolveRange(query);
      const where = rangeWhere(range);

      const [groups, totals] = await Promise.all([
        prisma.tokenUsage.groupBy({
          by: ['orgId'],
          where,
          _sum: { inputTokens: true, outputTokens: true, totalTokens: true, costUsd: true },
          _count: { _all: true },
          orderBy: [{ _sum: { totalTokens: 'desc' } }, { orgId: 'asc' }],
          take: query.limit,
        }),
        prisma.tokenUsage.aggregate({ where, _sum: { totalTokens: true } }),
      ]);

      const grandTotal = totals._sum.totalTokens ?? 0;
      const names = await orgNameMap(groups.map((g) => g.orgId));

      res.json({
        success: true,
        data: groups.map((g, index) => ({
          rank: index + 1,
          orgId: g.orgId,
          orgName: names.get(g.orgId) ?? null,
          inputTokens: g._sum.inputTokens ?? 0,
          outputTokens: g._sum.outputTokens ?? 0,
          totalTokens: g._sum.totalTokens ?? 0,
          cost: toCost(g._sum.costUsd),
          requests: g._count._all,
          share: share(g._sum.totalTokens ?? 0, grandTotal),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
