import { Router } from 'express';
import { z } from 'zod';
import { analyticsService } from '../services/analytics.service';
import { authenticate, orgContext } from '../middleware/auth';
import { validate } from '../middleware/validate';

interface OrgParams { orgId: string; [key: string]: string; }

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// ─── Shared schemas ──────────────────────────────────────────────

const dateRangeSchema = z.object({
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});

const conversationMetricsSchema = z.object({
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

// ─── GET /overview ───────────────────────────────────────────────

router.get(
  '/overview',
  validate({ query: dateRangeSchema }),
  async (req, res, next) => {
    try {
      const { orgId } = req.params as OrgParams;
      const query = (req as any).validatedQuery ?? {};

      const startDate = query.startDate ? new Date(query.startDate) : undefined;
      const endDate = query.endDate ? new Date(query.endDate) : undefined;

      const overview = await analyticsService.getOverview(orgId, startDate, endDate);
      res.json({ success: true, data: overview });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /conversations-metrics ──────────────────────────────────

router.get(
  '/conversations-metrics',
  validate({ query: conversationMetricsSchema }),
  async (req, res, next) => {
    try {
      const { orgId } = req.params as OrgParams;
      const query = (req as any).validatedQuery ?? {};

      const metrics = await analyticsService.getConversationMetrics(orgId, {
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        groupBy: query.groupBy ?? 'day',
      });

      res.json({ success: true, data: metrics });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /agent-performance ──────────────────────────────────────

router.get('/agent-performance', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const data = await analyticsService.getAgentPerformance(orgId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /channel-breakdown ──────────────────────────────────────

router.get('/channel-breakdown', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const data = await analyticsService.getChannelBreakdown(orgId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /lead-funnel ────────────────────────────────────────────

router.get('/lead-funnel', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const data = await analyticsService.getLeadFunnel(orgId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /csat-trends ───────────────────────────────────────────

router.get(
  '/csat-trends',
  validate({ query: conversationMetricsSchema }),
  async (req, res, next) => {
    try {
      const { orgId } = req.params as OrgParams;
      const query = (req as any).validatedQuery ?? {};

      const data = await analyticsService.getCsatTrends(orgId, {
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        groupBy: query.groupBy ?? 'day',
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /response-time-trends ──────────────────────────────────

router.get(
  '/response-time-trends',
  validate({ query: conversationMetricsSchema }),
  async (req, res, next) => {
    try {
      const { orgId } = req.params as OrgParams;
      const query = (req as any).validatedQuery ?? {};

      const data = await analyticsService.getResponseTimeTrends(orgId, {
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        groupBy: query.groupBy ?? 'day',
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
