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

  private dateTruncExpr(groupBy: GroupBy, timezone: string = 'UTC'): string {
    const safeTz = timezone.replace(/[^a-zA-Z0-9/_+-]/g, '');
    switch (groupBy) {
      case 'day':
        return `date_trunc('day', "createdAt" AT TIME ZONE '${safeTz}')`;
      case 'week':
        return `date_trunc('week', "createdAt" AT TIME ZONE '${safeTz}')`;
      case 'month':
        return `date_trunc('month', "createdAt" AT TIME ZONE '${safeTz}')`;
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
      SELECT ${Prisma.raw(trunc.replace(/"createdAt"/g, 'm."createdAt"'))} AS "date",
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
    const [
      agentConversations,
      agentResolvedConversations,
      agentMessages,
      agentResponseTimes,
    ] = await Promise.all([
      // Total conversations per agent
      prisma.conversation.groupBy({
        by: ['agentId'],
        where: { orgId, agentId: { not: null } },
        _count: { _all: true },
      }),
      // Resolved conversations per agent
      prisma.conversation.groupBy({
        by: ['agentId'],
        where: { orgId, agentId: { not: null }, status: 'RESOLVED' },
        _count: { _all: true },
      }),
      // Messages per agent
      prisma.message.groupBy({
        by: ['conversationId'],
        where: {
          conversation: { orgId, agentId: { not: null } },
        },
        _count: { _all: true },
      }),
      // Avg response time per agent
      prisma.message.groupBy({
        by: ['conversationId'],
        where: {
          conversation: { orgId, agentId: { not: null } },
          role: 'AI_AGENT',
          latencyMs: { not: null },
        },
        _avg: { latencyMs: true },
      }),
    ]);

    // Get conversation -> agent mapping for message aggregation
    const agentIds = agentConversations.map((c) => c.agentId).filter((id): id is string => id !== null);

    const [conversations, agents] = await Promise.all([
      prisma.conversation.findMany({
        where: { orgId, agentId: { in: agentIds } },
        select: { id: true, agentId: true },
      }),
      prisma.agent.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, name: true },
      }),
    ]);

    const convAgentMap = new Map(conversations.map((c) => [c.id, c.agentId]));
    const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));

    // Build per-agent totals
    const agentStats = new Map<string, {
      totalConversations: number;
      totalMessages: number;
      resolvedCount: number;
      totalLatency: number;
      latencyCount: number;
    }>();

    // Aggregate conversation counts
    for (const row of agentConversations) {
      if (!row.agentId) continue;
      const existing = agentStats.get(row.agentId) ?? {
        totalConversations: 0,
        totalMessages: 0,
        resolvedCount: 0,
        totalLatency: 0,
        latencyCount: 0,
      };
      existing.totalConversations = row._count._all;
      agentStats.set(row.agentId, existing);
    }

    // Aggregate resolved counts
    for (const row of agentResolvedConversations) {
      if (!row.agentId) continue;
      const existing = agentStats.get(row.agentId);
      if (existing) {
        existing.resolvedCount = row._count._all;
      }
    }

    // Aggregate message counts
    for (const row of agentMessages) {
      const agentId = convAgentMap.get(row.conversationId);
      if (!agentId) continue;
      const existing = agentStats.get(agentId);
      if (existing) {
        existing.totalMessages += row._count._all;
      }
    }

    // Aggregate response times
    for (const row of agentResponseTimes) {
      const agentId = convAgentMap.get(row.conversationId);
      if (!agentId || !row._avg.latencyMs) continue;
      const existing = agentStats.get(agentId);
      if (existing) {
        existing.totalLatency += row._avg.latencyMs;
        existing.latencyCount += 1;
      }
    }

    // Build final results
    return Array.from(agentStats.entries()).map(([agentId, stats]) => ({
      agentId,
      agentName: agentNameMap.get(agentId) ?? 'Unknown',
      totalConversations: stats.totalConversations,
      totalMessages: stats.totalMessages,
      avgResponseTimeMs: stats.latencyCount > 0
        ? Math.round(stats.totalLatency / stats.latencyCount)
        : 0,
      resolvedCount: stats.resolvedCount,
    }));
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

  // ─── 8. Queue Depth (active conversations per agent) ────────────

  async getQueueDepth(orgId: string, userId?: string) {
    const cacheKey = userId
      ? `queue-depth:${orgId}:${userId}`
      : `queue-depth:${orgId}`;

    return this.cached(cacheKey, 60, async () => {
    const where = userId
      ? { orgId, assignedToHuman: userId, status: { in: ['ACTIVE' as const, 'HANDED_OFF' as const, 'WAITING' as const] } }
      : { orgId, status: { in: ['ACTIVE' as const, 'HANDED_OFF' as const, 'WAITING' as const] }, assignedToHuman: { not: null } };

    if (userId) {
      const count = await prisma.conversation.count({ where });
      return { userId, queueDepth: count };
    }

    const conversations = await prisma.conversation.findMany({
      where,
      select: { assignedToHuman: true },
    });

    const queueByAgent = new Map<string, number>();
    for (const conv of conversations) {
      if (conv.assignedToHuman) {
        const current = queueByAgent.get(conv.assignedToHuman) ?? 0;
        queueByAgent.set(conv.assignedToHuman, current + 1);
      }
    }

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(queueByAgent.keys()) } },
      select: { id: true, firstName: true, lastName: true },
    });

    return users.map((user) => ({
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      queueDepth: queueByAgent.get(user.id) ?? 0,
    }));
    }); // end cached
  }

  // ─── 9. Handoff Volume Tracking ─────────────────────────────────

  async getHandoffVolume(orgId: string, startDate?: Date, endDate?: Date) {
    const start = startDate ?? this.defaultStart();
    const end = endDate ?? this.defaultEnd();
    const cacheKey = `handoff-volume:${orgId}:${start.toISOString().slice(0, 10)}:${end.toISOString().slice(0, 10)}`;

    return this.cached(cacheKey, 300, async () => {
    const [totalHandoffs, handoffsByAgent] = await Promise.all([
      prisma.analyticsEvent.count({
        where: {
          orgId,
          eventType: 'HUMAN_HANDOFF',
          date: { gte: start, lte: end },
        },
      }),
      prisma.conversation.groupBy({
        by: ['assignedToHuman'],
        where: {
          orgId,
          status: { in: ['HANDED_OFF', 'WAITING', 'RESOLVED'] },
          assignedToHuman: { not: null },
          updatedAt: { gte: start, lte: end },
        },
        _count: { _all: true },
      }),
    ]);

    const userIds = handoffsByAgent
      .map((h) => h.assignedToHuman)
      .filter((id): id is string => id !== null);

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    return {
      totalHandoffs,
      byAgent: handoffsByAgent.map((row) => ({
        userId: row.assignedToHuman,
        userName: row.assignedToHuman ? userMap.get(row.assignedToHuman) : 'Unknown',
        handoffCount: row._count._all,
      })),
    };
    }); // end cached
  }

  // ─── 10. Agent Availability Status ──────────────────────────────

  async getAgentAvailabilityStatus(orgId: string) {
    return this.cached(`availability:${orgId}`, 60, async () => {
    const recentThreshold = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes

    const recentMessages = await prisma.message.findMany({
      where: {
        conversation: { orgId },
        role: 'HUMAN_AGENT',
        createdAt: { gte: recentThreshold },
        humanAgentId: { not: null },
      },
      select: { humanAgentId: true },
      distinct: ['humanAgentId'],
    });

    const activeAgentIds = recentMessages
      .map((m) => m.humanAgentId)
      .filter((id): id is string => id !== null);

    const allAgents = await prisma.orgMembership.findMany({
      where: { orgId },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            lastLoginAt: true,
          },
        },
      },
    });

    return allAgents.map((membership) => ({
      userId: membership.user.id,
      userName: `${membership.user.firstName} ${membership.user.lastName}`,
      isOnline: activeAgentIds.includes(membership.user.id),
      lastLoginAt: membership.user.lastLoginAt,
    }));
    }); // end cached
  }

  // ─── 11. Team Performance Time-Series ───────────────────────────

  async getTeamPerformance(orgId: string, params: ConversationMetricsParams) {
    const start = params.startDate ?? this.defaultStart();
    const end = params.endDate ?? this.defaultEnd();
    const trunc = this.dateTruncExpr(params.groupBy);
    const cacheKey = `team-perf:${orgId}:${params.groupBy}:${start.toISOString().slice(0, 10)}:${end.toISOString().slice(0, 10)}`;

    return this.cached(cacheKey, 300, async () => {
    const handoffsByPeriod = await prisma.$queryRaw<TimeBucket[]>`
      SELECT ${Prisma.raw(trunc.replace(/"createdAt"/g, 'ae."createdAt"'))} AS "date",
             COUNT(*)::bigint AS "count"
        FROM "analytics_events" ae
       WHERE ae."orgId" = ${orgId}
         AND ae."eventType" = 'HUMAN_HANDOFF'
         AND ae."createdAt" >= ${start}
         AND ae."createdAt" <= ${end}
       GROUP BY 1
       ORDER BY 1
    `;

    const humanMessagesByPeriod = await prisma.$queryRaw<TimeBucket[]>`
      SELECT ${Prisma.raw(trunc.replace(/"createdAt"/g, 'm."createdAt"'))} AS "date",
             COUNT(*)::bigint AS "count"
        FROM "messages" m
        JOIN "conversations" c ON c."id" = m."conversationId"
       WHERE c."orgId" = ${orgId}
         AND m."role" = 'HUMAN_AGENT'
         AND m."createdAt" >= ${start}
         AND m."createdAt" <= ${end}
       GROUP BY 1
       ORDER BY 1
    `;

    const activeAgentsByPeriod = await prisma.$queryRaw<
      { date: Date; count: bigint }[]
    >`
      SELECT ${Prisma.raw(trunc.replace(/"createdAt"/g, 'm."createdAt"'))} AS "date",
             COUNT(DISTINCT m."humanAgentId")::bigint AS "count"
        FROM "messages" m
        JOIN "conversations" c ON c."id" = m."conversationId"
       WHERE c."orgId" = ${orgId}
         AND m."role" = 'HUMAN_AGENT'
         AND m."humanAgentId" IS NOT NULL
         AND m."createdAt" >= ${start}
         AND m."createdAt" <= ${end}
       GROUP BY 1
       ORDER BY 1
    `;

    return {
      handoffs: handoffsByPeriod.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      humanMessages: humanMessagesByPeriod.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      activeAgents: activeAgentsByPeriod.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
    };
    }); // end cached
  }
}

export const analyticsService = new AnalyticsService();
