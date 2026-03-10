import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { teamPerformanceService } from '../../services/teamPerformance.service';
import { pdfReportService } from '../../services/pdfReport.service';
import { validate } from '../../middleware/validate';
import { BadRequestError } from '../../utils/errors';
import { csvSanitize } from '../../utils/csvSanitize';

const dateRangeQuerySchema = z.object({
  orgId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const agentComparisonQuerySchema = z.object({
  orgId: z.string().min(1),
  agentIds: z.string().min(1), // comma-separated agent IDs
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const realTimeQuerySchema = z.object({
  orgId: z.string().min(1),
});

const router: Router = Router();

// ─── Helper: build CSV string from headers + rows ──────────────────
function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(csvSanitize).join(','));
  }
  return lines.join('\n');
}

// GET /real-time - Real-time metrics (active conversations, queue depth, wait times, agent availability)
router.get('/real-time', validate({ query: realTimeQuerySchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.query as z.infer<typeof realTimeQuerySchema>;
    const data = await teamPerformanceService.getRealTimeMetrics(orgId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /historical - Historical metrics (conversations, response times, resolution times, CSAT, handoffs)
router.get('/historical', validate({ query: dateRangeQuerySchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, startDate, endDate } = req.query as z.infer<typeof dateRangeQuerySchema>;

    const dateRange = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const data = await teamPerformanceService.getHistoricalMetrics(orgId, dateRange);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /agents/compare - Side-by-side agent performance comparison
router.get('/agents/compare', validate({ query: agentComparisonQuerySchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, agentIds, startDate, endDate } = req.query as z.infer<typeof agentComparisonQuerySchema>;

    // Parse comma-separated agent IDs
    const agentIdArray = agentIds.split(',').map(id => id.trim()).filter(id => id.length > 0);

    if (agentIdArray.length === 0) {
      throw new BadRequestError('At least one agentId is required');
    }

    const dateRange = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const data = await teamPerformanceService.getAgentPerformanceComparison(orgId, agentIdArray, dateRange);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /ai-vs-human - AI vs human performance comparison
router.get('/ai-vs-human', validate({ query: dateRangeQuerySchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, startDate, endDate } = req.query as z.infer<typeof dateRangeQuerySchema>;

    const dateRange = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const data = await teamPerformanceService.getAiVsHumanMetrics(orgId, dateRange);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /export/csv - Export historical metrics to CSV
router.get('/export/csv', validate({ query: dateRangeQuerySchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, startDate, endDate } = req.query as z.infer<typeof dateRangeQuerySchema>;

    const dateRange = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const data = await teamPerformanceService.getHistoricalMetrics(orgId, dateRange);

    // Convert agentMetrics array to CSV format (not the entire data object)
    const agentMetrics = data.agentMetrics as unknown as Record<string, unknown>[];

    if (!agentMetrics.length) {
      res.setHeader('Content-Type', 'text/csv;charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="team-performance.csv"');
      res.send('');
      return;
    }

    const headers = Object.keys(agentMetrics[0]!);
    const rows = agentMetrics.map((metric) =>
      headers.map((h) => {
        const val = metric[h];
        return val === null || val === undefined ? '' : String(val);
      })
    );

    const csvContent = buildCsv(headers, rows);

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="team-performance.csv"');
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

// GET /export/pdf - Export team performance report to PDF
router.get('/export/pdf', validate({ query: dateRangeQuerySchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, startDate, endDate } = req.query as z.infer<typeof dateRangeQuerySchema>;

    // Generate PDF report
    const pdfBuffer = await pdfReportService.generateTeamPerformanceReport(orgId, startDate, endDate);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="team-performance-report.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

export default router;
