import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { Prisma } from '@prisma/client';

type GroupBy = 'day' | 'week' | 'month';

interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

interface ConversationMetricsParams extends DateRange {
  groupBy: GroupBy;
}

interface TimeBucket {
  date: Date;
  count: bigint;
}

export class AnalyticsService {
  // ─── cache helper ─────────────────────────────────────────────────

  private async cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cacheKey = `analytics:${key}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      logger.debug({ err }, 'Analytics cache read failed');
    }

    const result = await fn();

    try {
      const serialized = JSON.stringify(result, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      );
      await redis.set(cacheKey, serialized, 'EX', ttlSeconds);
    } catch (err) {
      logger.debug({ err }, 'Analytics cache write failed');
    }

    return result;
  }

  // ─── helpers ──────────────────────────────────────────────────────

  private defaultStart(): Date {
    return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  private defaultEnd(): Date {
    return new Date();
  }

  private dateTruncExpr(groupBy: GroupBy): string {
    switch (groupBy) {
      case 'day':
        return `date_trunc('day', "createdAt")`;
      case 'week':
        return `date_trunc('week', "createdAt")`;
      case 'month':
        return `date_trunc('month', "createdAt")`;
    }
  }

  // ─── 1. Overview (existing, now with optional date range) ────────

  async getOverview(orgId: string, startDate?: Date, endDate?: Date) {
    const start = startDate ?? this.defaultStart();
    const end = endDate ?? this.defaultEnd();
    const cacheKey = `overview:${orgId}:${start.toISOString().slice(0, 10)}:${end.toISOString().slice(0, 10)}`;

    return this.cached(cacheKey, 300, async () => {
    const [
      totalConversations,
      totalMessages,
      totalLeads,
      activeConversations,
      resolvedConversations,
      handoffCount,
      avgResponseTime,
    ] = await Promise.all([
      prisma.conversation.count({
        where: { orgId, createdAt: { gte: start, lte: end } },
      }),
      prisma.message.count({
        where: {
          conversation: { orgId },
          createdAt: { gte: start, lte: end },
        },
      }),
      prisma.lead.count({
        where: { orgId, createdAt: { gte: start, lte: end } },
      }),
      prisma.conversation.count({
        where: { orgId, status: 'ACTIVE' },
      }),
      prisma.conversation.count({
        where: {
          orgId,
          status: 'RESOLVED',
          resolvedAt: { gte: start, lte: end },
        },
      }),
      prisma.analyticsEvent.count({
        where: {
          orgId,
          eventType: 'HUMAN_HANDOFF',
          date: { gte: start, lte: end },
        },
      }),
      prisma.message.aggregate({
        where: {
          conversation: { orgId },
          role: 'AI_AGENT',
          createdAt: { gte: start, lte: end },
          latencyMs: { not: null },
        },
        _avg: { latencyMs: true },
      }),
    ]);

    const handoffRate =
      totalConversations > 0 ? handoffCount / totalConversations : 0;

    return {
      totalConversations,
      totalMessages,
      totalLeads,
      activeConversations,
      resolvedConversations,
      averageResponseTimeMs: Math.round(avgResponseTime._avg.latencyMs || 0),
      handoffRate: Math.round(handoffRate * 100) / 100,
    };
    }); // end cached
  }

  // ─── 2. Conversation metrics (time-series) ──────────────────────

  async getConversationMetrics(orgId: string, params: ConversationMetricsParams) {
    const start = params.startDate ?? this.defaultStart();
    const end = params.endDate ?? this.defaultEnd();
    const trunc = this.dateTruncExpr(params.groupBy);
    const cacheKey = `conv-metrics:${orgId}:${params.groupBy}:${start.toISOString().slice(0, 10)}:${end.toISOString().slice(0, 10)}`;

    return this.cached(cacheKey, 300, async () => {
    const conversationsPerPeriod = await prisma.$queryRaw<TimeBucket[]>`
      SELECT ${Prisma.raw(trunc)} AS "date",
             COUNT(*)::bigint      AS "count"
        FROM "conversations"
       WHERE "orgId" = ${orgId}
         AND "createdAt" >= ${start}
         AND "createdAt" <= ${end}
       GROUP BY 1
       ORDER BY 1
    `;

    const messagesPerPeriod = await prisma.$queryRaw<TimeBucket[]>`
      SELECT ${Prisma.raw(trunc)} AS "date",
             COUNT(*)::bigint      AS "count"
        FROM "messages" m
        JOIN "conversations" c ON c."id" = m."conversationId"
       WHERE c."orgId" = ${orgId}
         AND m."createdAt" >= ${start}
         AND m."createdAt" <= ${end}
       GROUP BY 1
       ORDER BY 1
    `;

    return {
      conversations: conversationsPerPeriod.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      messages: messagesPerPeriod.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
    };
    }); // end cached
  }

  // ─── 3. Agent performance ───────────────────────────────────────

  async getAgentPerformance(orgId: string) {
    return this.cached(`agent-perf:${orgId}`, 300, async () => {
    const agents = await prisma.agent.findMany({
      where: { orgId },
      select: { id: true, name: true },
    });

    const results = await Promise.all(
      agents.map(async (agent) => {
        const [totalConversations, totalMessages, avgResponseTime, resolvedCount] =
          await Promise.all([
            prisma.conversation.count({
              where: { orgId, agentId: agent.id },
            }),
            prisma.message.count({
              where: {
                conversation: { orgId, agentId: agent.id },
              },
            }),
            prisma.message.aggregate({
              where: {
                conversation: { orgId, agentId: agent.id },
                role: 'AI_AGENT',
                latencyMs: { not: null },
              },
              _avg: { latencyMs: true },
            }),
            prisma.conversation.count({
              where: { orgId, agentId: agent.id, status: 'RESOLVED' },
            }),
          ]);

        return {
          agentId: agent.id,
          agentName: agent.name,
          totalConversations,
          totalMessages,
          avgResponseTimeMs: Math.round(avgResponseTime._avg.latencyMs || 0),
          resolvedCount,
        };
      }),
    );

    return results;
    }); // end cached
  }

  // ─── 4. Channel breakdown ──────────────────────────────────────

  async getChannelBreakdown(orgId: string) {
    return this.cached(`channel-breakdown:${orgId}`, 600, async () => {
    const channelConversations = await prisma.conversation.groupBy({
      by: ['channelId'],
      where: { orgId },
      _count: { _all: true },
    });

    const channelIds = channelConversations.map((c) => c.channelId);

    const channels = await prisma.channel.findMany({
      where: { id: { in: channelIds } },
      select: { id: true, type: true },
    });

    const channelTypeMap = new Map(channels.map((c) => [c.id, c.type]));

    // Aggregate messages per channel
    const channelMessages = await prisma.message.groupBy({
      by: ['conversationId'],
      where: { conversation: { orgId } },
      _count: { _all: true },
    });

    // We need conversation -> channel mapping for message totals
    const conversationChannels = await prisma.conversation.findMany({
      where: { orgId },
      select: { id: true, channelId: true },
    });

    const convChannelMap = new Map(conversationChannels.map((c) => [c.id, c.channelId]));

    // Build per-channel-type totals
    const breakdown = new Map<string, { totalConversations: number; totalMessages: number }>();

    for (const row of channelConversations) {
      const channelType = channelTypeMap.get(row.channelId) ?? 'UNKNOWN';
      const existing = breakdown.get(channelType) ?? { totalConversations: 0, totalMessages: 0 };
      existing.totalConversations += row._count._all;
      breakdown.set(channelType, existing);
    }

    for (const row of channelMessages) {
      const channelId = convChannelMap.get(row.conversationId);
      const channelType = channelId ? (channelTypeMap.get(channelId) ?? 'UNKNOWN') : 'UNKNOWN';
      const existing = breakdown.get(channelType) ?? { totalConversations: 0, totalMessages: 0 };
      existing.totalMessages += row._count._all;
      breakdown.set(channelType, existing);
    }

    return Array.from(breakdown.entries()).map(([channelType, data]) => ({
      channelType,
      totalConversations: data.totalConversations,
      totalMessages: data.totalMessages,
    }));
    }); // end cached
  }

  // ─── 5. Lead funnel ────────────────────────────────────────────

  async getLeadFunnel(orgId: string) {
    return this.cached(`lead-funnel:${orgId}`, 300, async () => {
    const [totalLeads, statusCounts] = await Promise.all([
      prisma.lead.count({ where: { orgId } }),
      prisma.lead.groupBy({
        by: ['status'],
        where: { orgId },
        _count: { _all: true },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    let convertedCount = 0;

    for (const row of statusCounts) {
      byStatus[row.status] = row._count._all;
      if (row.status === 'CONVERTED') {
        convertedCount = row._count._all;
      }
    }

    // Ensure every status key is present
    for (const status of ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']) {
      if (!(status in byStatus)) {
        byStatus[status] = 0;
      }
    }

    const conversionRate =
      totalLeads > 0
        ? Math.round((convertedCount / totalLeads) * 10000) / 10000
        : 0;

    return {
      totalLeads,
      byStatus,
      conversionRate,
    };
    }); // end cached
  }

  // ─── 6. CSAT Trends ─────────────────────────────────────────────

  async getCsatTrends(orgId: string, params: ConversationMetricsParams) {
    const start = params.startDate ?? this.defaultStart();
    const end = params.endDate ?? this.defaultEnd();
    const trunc = this.dateTruncExpr(params.groupBy);
    const cacheKey = `csat:${orgId}:${params.groupBy}:${start.toISOString().slice(0, 10)}:${end.toISOString().slice(0, 10)}`;

    return this.cached(cacheKey, 300, async () => {
    const rows = await prisma.$queryRaw<
      { date: Date; avgRating: number; count: bigint }[]
    >`
      SELECT ${Prisma.raw(trunc.replace(/"createdAt"/g, 'cr."createdAt"'))} AS "date",
             AVG(cr."rating")::float AS "avgRating",
             COUNT(*)::bigint     AS "count"
        FROM "conversation_ratings" cr
        JOIN "conversations" c ON c."id" = cr."conversationId"
       WHERE c."orgId" = ${orgId}
         AND cr."createdAt" >= ${start}
         AND cr."createdAt" <= ${end}
       GROUP BY 1
       ORDER BY 1
    `;

    return rows.map((r) => ({
      date: r.date,
      avgRating: Math.round(r.avgRating * 100) / 100,
      count: Number(r.count),
    }));
    }); // end cached
  }

  // ─── 7. Response Time Trends ────────────────────────────────────

  async getResponseTimeTrends(orgId: string, params: ConversationMetricsParams) {
    const start = params.startDate ?? this.defaultStart();
    const end = params.endDate ?? this.defaultEnd();
    const trunc = this.dateTruncExpr(params.groupBy);
    const cacheKey = `resp-time:${orgId}:${params.groupBy}:${start.toISOString().slice(0, 10)}:${end.toISOString().slice(0, 10)}`;

    return this.cached(cacheKey, 300, async () => {
    const rows = await prisma.$queryRaw<
      { date: Date; avgResponseTimeMs: number; count: bigint }[]
    >`
      SELECT ${Prisma.raw(trunc.replace(/"createdAt"/g, 'm."createdAt"'))} AS "date",
             AVG(m."latencyMs")::float AS "avgResponseTimeMs",
             COUNT(*)::bigint          AS "count"
        FROM "messages" m
        JOIN "conversations" c ON c."id" = m."conversationId"
       WHERE c."orgId" = ${orgId}
         AND m."role" = 'AI_AGENT'
         AND m."latencyMs" IS NOT NULL
         AND m."createdAt" >= ${start}
         AND m."createdAt" <= ${end}
       GROUP BY 1
       ORDER BY 1
    `;

    return rows.map((r) => ({
      date: r.date,
      avgResponseTimeMs: Math.round(r.avgResponseTimeMs),
      count: Number(r.count),
    }));
    }); // end cached
  }
}

export const analyticsService = new AnalyticsService();
