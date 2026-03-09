import { Router } from 'express';
import { prisma } from '../config/database';
import { analyticsService } from '../services/analytics.service';
import { authenticate, orgContext } from '../middleware/auth';
import { csvSanitize } from '../utils/csvSanitize';

interface OrgParams { orgId: string; [key: string]: string; }

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// ─── Helper: build CSV string from headers + rows ──────────────────
function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(csvSanitize).join(','));
  }
  return lines.join('\n');
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

    const rows = conversations.map((c) => [
      c.id,
      c.customerName ?? '',
      c.channel.type,
      c.status,
      String(c.messageCount),
      c.createdAt.toISOString(),
      c.resolvedAt ? c.resolvedAt.toISOString() : '',
    ]);

    const csv = buildCsv(headers, rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="conversations-export.csv"');
    res.send(csv);
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

    const rows = leads.map((l) => [
      l.id,
      l.name ?? '',
      l.email ?? '',
      l.phone ?? '',
      l.status,
      l.source ?? '',
      l.createdAt.toISOString(),
    ]);

    const csv = buildCsv(headers, rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads-export.csv"');
    res.send(csv);
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

    const rows = [
      ['totalConversations', String(overview.totalConversations)],
      ['totalMessages', String(overview.totalMessages)],
      ['totalLeads', String(overview.totalLeads)],
      ['activeConversations', String(overview.activeConversations)],
      ['resolvedConversations', String(overview.resolvedConversations)],
      ['averageResponseTimeMs', String(overview.averageResponseTimeMs)],
      ['handoffRate', String(overview.handoffRate)],
    ];

    const csv = buildCsv(headers, rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics-export.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
