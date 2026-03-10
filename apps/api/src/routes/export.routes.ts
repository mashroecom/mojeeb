import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '../config/database';
import { analyticsService } from '../services/analytics.service';
import { authenticate, orgContext } from '../middleware/auth';
import { csvSanitize } from '../utils/csvSanitize';

interface OrgParams { orgId: string; [key: string]: string; }

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// ─── Helper: stream CSV using async generator ──────────────────────
/**
 * Stream CSV data to response without building entire string in memory.
 * Processes rows one at a time to keep memory usage constant and event loop responsive.
 *
 * @param headers - CSV column headers
 * @param rows - Async generator that yields rows one at a time
 * @param res - Express response object
 */
async function streamCsv(
  headers: string[],
  rows: AsyncGenerator<string[], void, unknown>,
  res: Response
): Promise<void> {
  // Write headers first
  res.write(headers.join(',') + '\n');

  // Stream rows one at a time
  for await (const row of rows) {
    const sanitizedRow = row.map(csvSanitize).join(',');
    res.write(sanitizedRow + '\n');
  }

  // Signal end of stream
  res.end();
}

// ─── GET /api/v1/organizations/:orgId/export/conversations ─────────

router.get('/conversations', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;

    const conversations = await prisma.conversation.findMany({
      where: { orgId },
      include: { channel: { select: { type: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const headers = [
      'id',
      'customerName',
      'channel',
      'status',
      'messageCount',
      'createdAt',
      'resolvedAt',
    ];

    // Async generator that yields rows one at a time
    async function* generateRows() {
      for (const c of conversations) {
        yield [
          c.id,
          c.customerName ?? '',
          c.channel.type,
          c.status,
          String(c.messageCount),
          c.createdAt.toISOString(),
          c.resolvedAt ? c.resolvedAt.toISOString() : '',
        ];
      }
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="conversations-export.csv"');

    await streamCsv(headers, generateRows(), res);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/organizations/:orgId/export/leads ─────────────────

router.get('/leads', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;

    const leads = await prisma.lead.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const headers = [
      'id',
      'name',
      'email',
      'phone',
      'status',
      'source',
      'createdAt',
    ];

    // Async generator that yields rows one at a time
    async function* generateRows() {
      for (const l of leads) {
        yield [
          l.id,
          l.name ?? '',
          l.email ?? '',
          l.phone ?? '',
          l.status,
          l.source ?? '',
          l.createdAt.toISOString(),
        ];
      }
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads-export.csv"');

    await streamCsv(headers, generateRows(), res);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/organizations/:orgId/export/analytics ─────────────

router.get('/analytics', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;

    const overview = await analyticsService.getOverview(orgId);

    const headers = [
      'metric',
      'value',
    ];

    // Async generator that yields rows one at a time
    async function* generateRows() {
      yield ['totalConversations', String(overview.totalConversations)];
      yield ['totalMessages', String(overview.totalMessages)];
      yield ['totalLeads', String(overview.totalLeads)];
      yield ['activeConversations', String(overview.activeConversations)];
      yield ['resolvedConversations', String(overview.resolvedConversations)];
      yield ['averageResponseTimeMs', String(overview.averageResponseTimeMs)];
      yield ['handoffRate', String(overview.handoffRate)];
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics-export.csv"');

    await streamCsv(headers, generateRows(), res);
  } catch (err) {
    next(err);
  }
});

export default router;
