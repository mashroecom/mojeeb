import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';

const router: Router = Router();

// Rough cost estimates per 1k tokens
const COST_PER_1K: Record<string, number> = {
  'gpt-4o': 0.005,
  'gpt-4': 0.03,
  'gpt-3.5-turbo': 0.001,
  'claude-3-opus': 0.015,
  'claude-3-sonnet': 0.003,
  'claude-3-haiku': 0.00025,
};

const DEFAULT_COST_PER_1K = 0.003;

function estimateCost(model: string | null, totalTokens: number): number {
  const rate = (model && COST_PER_1K[model]) || DEFAULT_COST_PER_1K;
  return (totalTokens / 1000) * rate;
}

// GET /stats - Per-model performance stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const modelStats = await prisma.message.groupBy({
      by: ['aiModel', 'aiProvider'],
      where: { aiProvider: { not: null } },
      _count: { _all: true },
      _avg: { latencyMs: true, tokenCount: true },
      _sum: { tokenCount: true },
    });

    const models = modelStats.map((row) => {
      const totalTokens = row._sum.tokenCount ?? 0;
      return {
        model: row.aiModel || 'unknown',
        provider: row.aiProvider || 'unknown',
        totalMessages: row._count._all,
        avgLatency: Math.round(row._avg.latencyMs ?? 0),
        avgTokens: Math.round(row._avg.tokenCount ?? 0),
        totalTokens,
        estimatedCost: Number(estimateCost(row.aiModel, totalTokens).toFixed(4)),
      };
    });

    // Sort by message count descending
    models.sort((a, b) => b.totalMessages - a.totalMessages);

    const totalAIMessages = models.reduce((s, m) => s + m.totalMessages, 0);
    const totalCost = models.reduce((s, m) => s + m.estimatedCost, 0);
    const avgResponseTime = totalAIMessages > 0
      ? Math.round(models.reduce((s, m) => s + m.avgLatency * m.totalMessages, 0) / totalAIMessages)
      : 0;

    res.json({
      success: true,
      data: {
        models,
        totalAIMessages,
        avgResponseTime,
        totalCost: Number(totalCost.toFixed(4)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /usage - Daily model usage for last 30 days
router.get('/usage', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const usage = await prisma.$queryRaw<{ date: string; model: string; provider: string; count: number; totalTokens: number }[]>`
      SELECT DATE("createdAt") as date,
             COALESCE("aiModel", 'unknown') as model,
             COALESCE("aiProvider"::text, 'unknown') as provider,
             COUNT(*)::int as count,
             COALESCE(SUM("tokenCount"), 0)::int as "totalTokens"
      FROM "messages"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        AND "aiProvider" IS NOT NULL
      GROUP BY DATE("createdAt"), "aiModel", "aiProvider"
      ORDER BY date ASC
    `;

    res.json({
      success: true,
      data: usage.map((r) => ({
        date: r.date,
        model: r.model,
        provider: r.provider,
        count: Number(r.count),
        totalTokens: Number(r.totalTokens),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
