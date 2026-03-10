import PDFDocument from 'pdfkit';
import { prisma } from '../config/database';
import { teamPerformanceService } from './teamPerformance.service';

function collectToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function addTitle(doc: PDFKit.PDFDocument, title: string, dateRange: string) {
  doc.fontSize(22).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#666666')
    .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  if (dateRange) {
    doc.text(`Period: ${dateRange}`, { align: 'center' });
  }
  doc.fillColor('#000000');
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
  doc.moveDown(0.5);
}

function addSection(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.5);
  doc.fontSize(14).font('Helvetica-Bold').text(title);
  doc.moveDown(0.3);
}

function addKV(doc: PDFKit.PDFDocument, label: string, value: string | number) {
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(`${label}: `, { continued: true })
    .font('Helvetica')
    .text(String(value));
}

function buildDateRange(startDate?: string, endDate?: string): string {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `From ${startDate}`;
  if (endDate) return `Until ${endDate}`;
  return 'All time';
}

function buildDateFilter(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return undefined;
  return {
    ...(startDate ? { gte: new Date(startDate) } : {}),
    ...(endDate ? { lte: new Date(endDate) } : {}),
  };
}

export class PdfReportService {
  async generatePlatformOverview(startDate?: string, endDate?: string): Promise<Buffer> {
    const dateFilter = buildDateFilter(startDate, endDate);
    const dateRange = buildDateRange(startDate, endDate);

    const [totalUsers, newUsers, totalOrgs, totalConversations, totalMessages, totalRevenue] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: dateFilter ? { createdAt: dateFilter } : undefined,
        }),
        prisma.organization.count(),
        prisma.conversation.count({
          where: dateFilter ? { createdAt: dateFilter } : undefined,
        }),
        prisma.message.count({
          where: dateFilter ? { createdAt: dateFilter } : undefined,
        }),
        prisma.invoice.aggregate({
          _sum: { amount: true },
          where: {
            status: 'PAID',
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
        }),
      ]);

    const conversationsByStatus = await prisma.conversation.groupBy({
      by: ['status'],
      _count: { id: true },
      where: dateFilter ? { createdAt: dateFilter } : undefined,
    });

    const doc = new PDFDocument({ margin: 50 });
    const bufferPromise = collectToBuffer(doc);

    addTitle(doc, 'Platform Overview Report', dateRange);

    addSection(doc, 'Users');
    addKV(doc, 'Total Users', totalUsers);
    addKV(doc, 'New Users (in period)', newUsers);

    addSection(doc, 'Organizations');
    addKV(doc, 'Total Organizations', totalOrgs);

    addSection(doc, 'Conversations');
    addKV(doc, 'Total Conversations', totalConversations);
    for (const item of conversationsByStatus) {
      addKV(doc, `  ${item.status}`, item._count.id);
    }

    addSection(doc, 'Messages');
    addKV(doc, 'Total Messages', totalMessages);

    addSection(doc, 'Revenue');
    addKV(doc, 'Total Revenue', `$${(totalRevenue._sum.amount ?? 0).toFixed(2)}`);

    doc.end();
    return bufferPromise;
  }

  async generateRevenueReport(startDate?: string, endDate?: string): Promise<Buffer> {
    const dateFilter = buildDateFilter(startDate, endDate);
    const dateRange = buildDateRange(startDate, endDate);

    const revenueByPlan = await prisma.invoice.groupBy({
      by: ['subscriptionId'],
      _sum: { amount: true },
      _count: { id: true },
      where: {
        status: 'PAID',
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
    });

    const totalRevenue = await prisma.invoice.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PAID',
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
    });

    const activeSubscriptions = await prisma.subscription.groupBy({
      by: ['plan'],
      _count: { id: true },
      where: { status: 'ACTIVE' },
    });

    const topPayingOrgs = await prisma.invoice.groupBy({
      by: ['subscriptionId'],
      _sum: { amount: true },
      where: {
        status: 'PAID',
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });

    const subIds = topPayingOrgs.map((o: any) => o.subscriptionId);
    const subs = subIds.length
      ? await prisma.subscription.findMany({
          where: { id: { in: subIds } },
          include: { org: { select: { id: true, name: true } } },
        })
      : [];
    const orgMap = Object.fromEntries(subs.map((s) => [s.id, s.org.name]));

    const doc = new PDFDocument({ margin: 50 });
    const bufferPromise = collectToBuffer(doc);

    addTitle(doc, 'Revenue Report', dateRange);

    addSection(doc, 'Revenue Summary');
    addKV(doc, 'Total Revenue', `$${(totalRevenue._sum.amount ?? 0).toFixed(2)}`);

    addSection(doc, 'Active Subscriptions by Plan');
    for (const sub of activeSubscriptions) {
      addKV(doc, `  ${sub.plan}`, `${sub._count.id} subscriptions`);
    }

    // Estimate MRR from active subscriptions
    const mrrSubs = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      select: { plan: true },
    });
    addSection(doc, 'Monthly Recurring (Active Plans)');
    addKV(doc, 'Active Subscription Count', mrrSubs.length);

    addSection(doc, 'Revenue by Payment');
    for (const item of revenueByPlan) {
      addKV(
        doc,
        `  Payment group (${item._count.id} payments)`,
        `$${(item._sum.amount ?? 0).toFixed(2)}`,
      );
    }

    addSection(doc, 'Top Paying Organizations');
    for (const org of topPayingOrgs) {
      addKV(
        doc,
        `  ${orgMap[org.subscriptionId] ?? org.subscriptionId}`,
        `$${(org._sum.amount ?? 0).toFixed(2)}`,
      );
    }

    doc.end();
    return bufferPromise;
  }

  async generateUserGrowthReport(startDate?: string, endDate?: string): Promise<Buffer> {
    const dateFilter = buildDateFilter(startDate, endDate);
    const dateRange = buildDateRange(startDate, endDate);

    const totalUsers = await prisma.user.count();
    const newUsers = await prisma.user.count({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
    });

    // Get daily registrations (last 30 days or within range)
    const since = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000);
    const until = endDate ? new Date(endDate) : new Date();

    const usersInRange = await prisma.user.findMany({
      where: { createdAt: { gte: since, lte: until } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const dailyMap = new Map<string, number>();
    for (const u of usersInRange) {
      const day = u.createdAt.toISOString().split('T')[0] || '';
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    }

    const doc = new PDFDocument({ margin: 50 });
    const bufferPromise = collectToBuffer(doc);

    addTitle(doc, 'User Growth Report', dateRange);

    addSection(doc, 'Summary');
    addKV(doc, 'Total Users', totalUsers);
    addKV(doc, 'New Users (in period)', newUsers);

    addSection(doc, 'Daily Registrations');
    for (const [day, count] of dailyMap) {
      addKV(doc, `  ${day}`, count);
    }

    if (dailyMap.size === 0) {
      doc.fontSize(10).font('Helvetica').text('  No registrations in this period.');
    }

    doc.end();
    return bufferPromise;
  }

  async generateSubscriptionReport(startDate?: string, endDate?: string): Promise<Buffer> {
    const dateFilter = buildDateFilter(startDate, endDate);
    const dateRange = buildDateRange(startDate, endDate);

    const subscriptionsByPlan = await prisma.subscription.groupBy({
      by: ['plan'],
      _count: { id: true },
    });

    const subscriptionsByStatus = await prisma.subscription.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const recentSubs = await prisma.subscription.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      select: {
        plan: true,
        status: true,
        createdAt: true,
        org: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const doc = new PDFDocument({ margin: 50 });
    const bufferPromise = collectToBuffer(doc);

    addTitle(doc, 'Subscription Analysis Report', dateRange);

    addSection(doc, 'Subscriptions by Plan');
    for (const item of subscriptionsByPlan) {
      addKV(doc, `  ${item.plan}`, item._count.id);
    }

    addSection(doc, 'Subscriptions by Status');
    for (const item of subscriptionsByStatus) {
      addKV(doc, `  ${item.status}`, item._count.id);
    }

    addSection(doc, 'Recent Subscriptions');
    for (const sub of recentSubs) {
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(
          `  ${sub.org?.name ?? 'Unknown'} - ${sub.plan} (${sub.status}) - ${sub.createdAt.toISOString().split('T')[0]}`,
        );
    }

    if (recentSubs.length === 0) {
      doc.fontSize(10).font('Helvetica').text('  No subscriptions in this period.');
    }

    doc.end();
    return bufferPromise;
  }

  async generateTeamPerformanceReport(
    orgId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Buffer> {
    const dateRange = buildDateRange(startDate, endDate);

    // Fetch data from team performance service
    const dateRangeObj = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const [historicalData, aiVsHumanData] = await Promise.all([
      teamPerformanceService.getHistoricalMetrics(orgId, dateRangeObj),
      teamPerformanceService.getAiVsHumanMetrics(orgId, dateRangeObj),
    ]);

    const doc = new PDFDocument({ margin: 50 });
    const bufferPromise = collectToBuffer(doc);

    addTitle(doc, 'Team Performance Report', dateRange);

    // Overall Metrics Section
    addSection(doc, 'Overall Performance');
    addKV(doc, 'Total Conversations', historicalData.totalConversations);
    addKV(doc, 'Avg Response Time', `${(historicalData.avgResponseTimeMs / 1000).toFixed(2)}s`);
    addKV(
      doc,
      'Avg Resolution Time',
      `${(historicalData.avgResolutionTimeMs / 1000 / 60).toFixed(2)} min`,
    );
    addKV(doc, 'Avg CSAT', historicalData.avgCSAT.toFixed(2));
    addKV(doc, 'Handoff Count', historicalData.handoffCount);
    addKV(doc, 'Handoff Rate', `${(historicalData.handoffRate * 100).toFixed(2)}%`);

    // AI vs Human Section
    addSection(doc, 'AI vs Human Performance');

    doc.fontSize(12).font('Helvetica-Bold').text('AI Agent Performance:');
    doc.moveDown(0.2);
    addKV(doc, '  Conversations', aiVsHumanData.ai.conversationCount);
    addKV(doc, '  Avg Response Time', `${(aiVsHumanData.ai.avgResponseTimeMs / 1000).toFixed(2)}s`);
    addKV(
      doc,
      '  Avg Resolution Time',
      `${(aiVsHumanData.ai.avgResolutionTimeMs / 1000 / 60).toFixed(2)} min`,
    );
    addKV(doc, '  Avg CSAT', aiVsHumanData.ai.avgCSAT.toFixed(2));
    addKV(doc, '  Resolution Rate', `${(aiVsHumanData.ai.resolutionRate * 100).toFixed(2)}%`);

    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text('Human Agent Performance:');
    doc.moveDown(0.2);
    addKV(doc, '  Conversations', aiVsHumanData.human.conversationCount);
    addKV(
      doc,
      '  Avg Response Time',
      `${(aiVsHumanData.human.avgResponseTimeMs / 1000).toFixed(2)}s`,
    );
    addKV(
      doc,
      '  Avg Resolution Time',
      `${(aiVsHumanData.human.avgResolutionTimeMs / 1000 / 60).toFixed(2)} min`,
    );
    addKV(doc, '  Avg CSAT', aiVsHumanData.human.avgCSAT.toFixed(2));
    addKV(doc, '  Resolution Rate', `${(aiVsHumanData.human.resolutionRate * 100).toFixed(2)}%`);

    // Individual Agent Performance
    if (historicalData.agentMetrics.length > 0) {
      addSection(doc, 'Individual Agent Performance');

      for (const agent of historicalData.agentMetrics) {
        doc.moveDown(0.3);
        doc.fontSize(11).font('Helvetica-Bold').text(`${agent.agentName}:`);
        doc.moveDown(0.1);
        addKV(doc, '  Conversations', agent.conversationsHandled);
        addKV(doc, '  Messages', agent.messageCount);
        addKV(doc, '  Avg Response Time', `${(agent.avgResponseTimeMs / 1000).toFixed(2)}s`);
        addKV(
          doc,
          '  Avg Resolution Time',
          `${(agent.avgResolutionTimeMs / 1000 / 60).toFixed(2)} min`,
        );
        addKV(doc, '  Avg CSAT', agent.avgCSAT.toFixed(2));
        addKV(doc, '  Handoff Count', agent.handoffCount);
      }
    }

    doc.end();
    return bufferPromise;
  }
}

export const pdfReportService = new PdfReportService();
