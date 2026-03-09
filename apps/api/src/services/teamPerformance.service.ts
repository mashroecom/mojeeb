import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { Prisma } from '@prisma/client';

interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

interface RealTimeMetrics {
  activeConversations: number;
  queueDepth: number;
  averageWaitTimeMs: number;
  agentsOnline: number;
  activeAgents: AgentAvailability[];
}

interface AgentAvailability {
  agentId: string;
  agentName: string;
  status: 'online' | 'offline';
  activeConversations: number;
  lastActiveAt: Date | null;
}

interface HistoricalMetrics {
  totalConversations: number;
  avgResponseTimeMs: number;
  avgResolutionTimeMs: number;
  avgCSAT: number;
  handoffCount: number;
  handoffRate: number;
  agentMetrics: AgentMetrics[];
}

interface AgentMetrics {
  agentId: string;
  agentName: string;
  conversationsHandled: number;
  avgResponseTimeMs: number;
  avgResolutionTimeMs: number;
  avgCSAT: number;
  handoffCount: number;
  messageCount: number;
}

interface AiVsHumanMetrics {
  ai: {
    conversationCount: number;
    avgResponseTimeMs: number;
    avgResolutionTimeMs: number;
    avgCSAT: number;
    resolutionRate: number;
  };
  human: {
    conversationCount: number;
    avgResponseTimeMs: number;
    avgResolutionTimeMs: number;
    avgCSAT: number;
    resolutionRate: number;
  };
}

export class TeamPerformanceService {
  // ─── cache helper ─────────────────────────────────────────────────

  private async cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cacheKey = `team-performance:${key}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      logger.debug({ err }, 'Team performance cache read failed');
    }

    const result = await fn();

    try {
      const serialized = JSON.stringify(result, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      );
      await redis.set(cacheKey, serialized, 'EX', ttlSeconds);
    } catch (err) {
      logger.debug({ err }, 'Team performance cache write failed');
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

  // ─── 1. Real-time metrics ─────────────────────────────────────────

  async getRealTimeMetrics(orgId: string): Promise<RealTimeMetrics> {
    // Short cache for real-time data (30 seconds)
    return this.cached(`realtime:${orgId}`, 30, async () => {
      const [activeConversations, queueDepth, agentData] = await Promise.all([
        // Active conversations count
        prisma.conversation.count({
          where: { orgId, status: 'ACTIVE' },
        }),

        // Queue depth (conversations waiting for human)
        prisma.conversation.count({
          where: {
            orgId,
            status: { in: ['ACTIVE', 'WAITING', 'HANDED_OFF'] },
            assignedToHuman: { not: null },
          },
        }),

        // Agent activity data
        this.getAgentAvailability(orgId),
      ]);

      // Calculate average wait time for queued conversations
      const waitingConversations = await prisma.conversation.findMany({
        where: {
          orgId,
          status: { in: ['WAITING', 'HANDED_OFF'] },
          assignedToHuman: { not: null },
        },
        select: {
          lastMessageAt: true,
        },
      });

      let avgWaitTimeMs = 0;
      if (waitingConversations.length > 0) {
        const now = new Date();
        const totalWaitMs = waitingConversations.reduce((sum, conv) => {
          return sum + (now.getTime() - conv.lastMessageAt.getTime());
        }, 0);
        avgWaitTimeMs = Math.round(totalWaitMs / waitingConversations.length);
      }

      const agentsOnline = agentData.filter((a) => a.status === 'online').length;

      return {
        activeConversations,
        queueDepth,
        averageWaitTimeMs: avgWaitTimeMs,
        agentsOnline,
        activeAgents: agentData,
      };
    });
  }

  private async getAgentAvailability(orgId: string): Promise<AgentAvailability[]> {
    const agents = await prisma.agent.findMany({
      where: { orgId, isActive: true },
      select: { id: true, name: true },
    });

    const onlineThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes

    const availabilityPromises = agents.map(async (agent) => {
      const [activeConversations, lastMessage] = await Promise.all([
        prisma.conversation.count({
          where: {
            orgId,
            agentId: agent.id,
            status: { in: ['ACTIVE', 'HANDED_OFF'] },
          },
        }),

        prisma.message.findFirst({
          where: {
            conversation: { orgId, agentId: agent.id },
            role: 'AI_AGENT',
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

      const isOnline = lastMessage && lastMessage.createdAt > onlineThreshold;

      return {
        agentId: agent.id,
        agentName: agent.name,
        status: (isOnline ? 'online' : 'offline') as 'online' | 'offline',
        activeConversations,
        lastActiveAt: lastMessage?.createdAt || null,
      };
    });

    return Promise.all(availabilityPromises);
  }

  // ─── 2. Historical metrics ────────────────────────────────────────

  async getHistoricalMetrics(orgId: string, dateRange: DateRange): Promise<HistoricalMetrics> {
    const start = dateRange.startDate ?? this.defaultStart();
    const end = dateRange.endDate ?? this.defaultEnd();
    const cacheKey = `historical:${orgId}:${start.toISOString().slice(0, 10)}:${end.toISOString().slice(0, 10)}`;

    return this.cached(cacheKey, 300, async () => {
      const [totalConversations, handoffCount, avgResponseTime, agentMetrics] =
        await Promise.all([
          // Total conversations in period
          prisma.conversation.count({
            where: { orgId, createdAt: { gte: start, lte: end } },
          }),

          // Handoff count
          prisma.analyticsEvent.count({
            where: {
              orgId,
              eventType: 'HUMAN_HANDOFF',
              date: { gte: start, lte: end },
            },
          }),

          // Average response time
          prisma.message.aggregate({
            where: {
              conversation: { orgId },
              role: 'AI_AGENT',
              createdAt: { gte: start, lte: end },
              latencyMs: { not: null },
            },
            _avg: { latencyMs: true },
          }),

          // Agent-level metrics
          this.getAgentMetrics(orgId, start, end),
        ]);

      // Calculate average resolution time
      const resolvedConversations = await prisma.conversation.findMany({
        where: {
          orgId,
          status: 'RESOLVED',
          resolvedAt: { gte: start, lte: end },
        },
        select: {
          firstMessageAt: true,
          resolvedAt: true,
        },
      });

      let avgResolutionTimeMs = 0;
      if (resolvedConversations.length > 0) {
        const totalResolutionMs = resolvedConversations.reduce((sum, conv) => {
          if (!conv.resolvedAt) return sum;
          return sum + (conv.resolvedAt.getTime() - conv.firstMessageAt.getTime());
        }, 0);
        avgResolutionTimeMs = Math.round(totalResolutionMs / resolvedConversations.length);
      }

      // Calculate average CSAT
      const csatData = await prisma.conversationRating.aggregate({
        where: {
          conversation: {
            orgId,
            createdAt: { gte: start, lte: end },
          },
        },
        _avg: { rating: true },
      });

      const handoffRate = totalConversations > 0 ? handoffCount / totalConversations : 0;

      return {
        totalConversations,
        avgResponseTimeMs: Math.round(avgResponseTime._avg.latencyMs || 0),
        avgResolutionTimeMs,
        avgCSAT: Math.round((csatData._avg.rating || 0) * 100) / 100,
        handoffCount,
        handoffRate: Math.round(handoffRate * 100) / 100,
        agentMetrics,
      };
    });
  }

  private async getAgentMetrics(
    orgId: string,
    start: Date,
    end: Date,
  ): Promise<AgentMetrics[]> {
    const agents = await prisma.agent.findMany({
      where: { orgId },
      select: { id: true, name: true },
    });

    const metricsPromises = agents.map(async (agent) => {
      const [conversationsHandled, messageCount, avgResponseTime, handoffCount, csatData] =
        await Promise.all([
          // Conversations handled
          prisma.conversation.count({
            where: {
              orgId,
              agentId: agent.id,
              createdAt: { gte: start, lte: end },
            },
          }),

          // Message count
          prisma.message.count({
            where: {
              conversation: { orgId, agentId: agent.id },
              role: 'AI_AGENT',
              createdAt: { gte: start, lte: end },
            },
          }),

          // Average response time
          prisma.message.aggregate({
            where: {
              conversation: { orgId, agentId: agent.id },
              role: 'AI_AGENT',
              createdAt: { gte: start, lte: end },
              latencyMs: { not: null },
            },
            _avg: { latencyMs: true },
          }),

          // Handoffs for this agent
          prisma.analyticsEvent.count({
            where: {
              orgId,
              agentId: agent.id,
              eventType: 'HUMAN_HANDOFF',
              date: { gte: start, lte: end },
            },
          }),

          // CSAT for this agent
          prisma.conversationRating.aggregate({
            where: {
              conversation: {
                orgId,
                agentId: agent.id,
                createdAt: { gte: start, lte: end },
              },
            },
            _avg: { rating: true },
          }),
        ]);

      // Calculate average resolution time for this agent
      const resolvedConversations = await prisma.conversation.findMany({
        where: {
          orgId,
          agentId: agent.id,
          status: 'RESOLVED',
          resolvedAt: { gte: start, lte: end },
        },
        select: {
          firstMessageAt: true,
          resolvedAt: true,
        },
      });

      let avgResolutionTimeMs = 0;
      if (resolvedConversations.length > 0) {
        const totalResolutionMs = resolvedConversations.reduce((sum, conv) => {
          if (!conv.resolvedAt) return sum;
          return sum + (conv.resolvedAt.getTime() - conv.firstMessageAt.getTime());
        }, 0);
        avgResolutionTimeMs = Math.round(totalResolutionMs / resolvedConversations.length);
      }

      return {
        agentId: agent.id,
        agentName: agent.name,
        conversationsHandled,
        avgResponseTimeMs: Math.round(avgResponseTime._avg.latencyMs || 0),
        avgResolutionTimeMs,
        avgCSAT: Math.round((csatData._avg.rating || 0) * 100) / 100,
        handoffCount,
        messageCount,
      };
    });

    return Promise.all(metricsPromises);
  }

  // ─── 3. Agent performance comparison ──────────────────────────────

  async getAgentPerformanceComparison(
    orgId: string,
    agentIds: string[],
    dateRange: DateRange,
  ): Promise<AgentMetrics[]> {
    const start = dateRange.startDate ?? this.defaultStart();
    const end = dateRange.endDate ?? this.defaultEnd();
    const cacheKey = `comparison:${orgId}:${agentIds.sort().join(',')}:${start.toISOString().slice(0, 10)}:${end.toISOString().slice(0, 10)}`;

    return this.cached(cacheKey, 300, async () => {
      const agents = await prisma.agent.findMany({
        where: { orgId, id: { in: agentIds } },
        select: { id: true, name: true },
      });

      const metricsPromises = agents.map(async (agent) => {
        const [conversationsHandled, messageCount, avgResponseTime, handoffCount, csatData] =
          await Promise.all([
            prisma.conversation.count({
              where: {
                orgId,
                agentId: agent.id,
                createdAt: { gte: start, lte: end },
              },
            }),

            prisma.message.count({
              where: {
                conversation: { orgId, agentId: agent.id },
                role: 'AI_AGENT',
                createdAt: { gte: start, lte: end },
              },
            }),

            prisma.message.aggregate({
              where: {
                conversation: { orgId, agentId: agent.id },
                role: 'AI_AGENT',
                createdAt: { gte: start, lte: end },
                latencyMs: { not: null },
              },
              _avg: { latencyMs: true },
            }),

            prisma.analyticsEvent.count({
              where: {
                orgId,
                agentId: agent.id,
                eventType: 'HUMAN_HANDOFF',
                date: { gte: start, lte: end },
              },
            }),

            prisma.conversationRating.aggregate({
              where: {
                conversation: {
                  orgId,
                  agentId: agent.id,
                  createdAt: { gte: start, lte: end },
                },
              },
              _avg: { rating: true },
            }),
          ]);

        const resolvedConversations = await prisma.conversation.findMany({
          where: {
            orgId,
            agentId: agent.id,
            status: 'RESOLVED',
            resolvedAt: { gte: start, lte: end },
          },
          select: {
            firstMessageAt: true,
            resolvedAt: true,
          },
        });

        let avgResolutionTimeMs = 0;
        if (resolvedConversations.length > 0) {
          const totalResolutionMs = resolvedConversations.reduce((sum, conv) => {
            if (!conv.resolvedAt) return sum;
            return sum + (conv.resolvedAt.getTime() - conv.firstMessageAt.getTime());
          }, 0);
          avgResolutionTimeMs = Math.round(totalResolutionMs / resolvedConversations.length);
        }

        return {
          agentId: agent.id,
          agentName: agent.name,
          conversationsHandled,
          avgResponseTimeMs: Math.round(avgResponseTime._avg.latencyMs || 0),
          avgResolutionTimeMs,
          avgCSAT: Math.round((csatData._avg.rating || 0) * 100) / 100,
          handoffCount,
          messageCount,
        };
      });

      return Promise.all(metricsPromises);
    });
  }

  // ─── 4. AI vs Human metrics ───────────────────────────────────────

  async getAiVsHumanMetrics(orgId: string, dateRange: DateRange): Promise<AiVsHumanMetrics> {
    const start = dateRange.startDate ?? this.defaultStart();
    const end = dateRange.endDate ?? this.defaultEnd();
    const cacheKey = `ai-vs-human:${orgId}:${start.toISOString().slice(0, 10)}:${end.toISOString().slice(0, 10)}`;

    return this.cached(cacheKey, 300, async () => {
      // AI conversations (not assigned to human)
      const [aiConversations, aiResolvedConversations, aiResponseTime, aiCSAT] =
        await Promise.all([
          prisma.conversation.count({
            where: {
              orgId,
              createdAt: { gte: start, lte: end },
              assignedToHuman: null,
            },
          }),

          prisma.conversation.findMany({
            where: {
              orgId,
              status: 'RESOLVED',
              resolvedAt: { gte: start, lte: end },
              assignedToHuman: null,
            },
            select: {
              firstMessageAt: true,
              resolvedAt: true,
            },
          }),

          prisma.message.aggregate({
            where: {
              conversation: { orgId, assignedToHuman: null },
              role: 'AI_AGENT',
              createdAt: { gte: start, lte: end },
              latencyMs: { not: null },
            },
            _avg: { latencyMs: true },
          }),

          prisma.conversationRating.aggregate({
            where: {
              conversation: {
                orgId,
                createdAt: { gte: start, lte: end },
                assignedToHuman: null,
              },
            },
            _avg: { rating: true },
          }),
        ]);

      // Human conversations (assigned to human)
      const [humanConversations, humanResolvedConversations, humanResponseTime, humanCSAT] =
        await Promise.all([
          prisma.conversation.count({
            where: {
              orgId,
              createdAt: { gte: start, lte: end },
              assignedToHuman: { not: null },
            },
          }),

          prisma.conversation.findMany({
            where: {
              orgId,
              status: 'RESOLVED',
              resolvedAt: { gte: start, lte: end },
              assignedToHuman: { not: null },
            },
            select: {
              firstMessageAt: true,
              resolvedAt: true,
            },
          }),

          prisma.message.aggregate({
            where: {
              conversation: { orgId, assignedToHuman: { not: null } },
              role: 'HUMAN_AGENT',
              createdAt: { gte: start, lte: end },
              latencyMs: { not: null },
            },
            _avg: { latencyMs: true },
          }),

          prisma.conversationRating.aggregate({
            where: {
              conversation: {
                orgId,
                createdAt: { gte: start, lte: end },
                assignedToHuman: { not: null },
              },
            },
            _avg: { rating: true },
          }),
        ]);

      // Calculate AI metrics
      let aiAvgResolutionTimeMs = 0;
      if (aiResolvedConversations.length > 0) {
        const totalMs = aiResolvedConversations.reduce((sum, conv) => {
          if (!conv.resolvedAt) return sum;
          return sum + (conv.resolvedAt.getTime() - conv.firstMessageAt.getTime());
        }, 0);
        aiAvgResolutionTimeMs = Math.round(totalMs / aiResolvedConversations.length);
      }

      const aiResolutionRate =
        aiConversations > 0 ? aiResolvedConversations.length / aiConversations : 0;

      // Calculate Human metrics
      let humanAvgResolutionTimeMs = 0;
      if (humanResolvedConversations.length > 0) {
        const totalMs = humanResolvedConversations.reduce((sum, conv) => {
          if (!conv.resolvedAt) return sum;
          return sum + (conv.resolvedAt.getTime() - conv.firstMessageAt.getTime());
        }, 0);
        humanAvgResolutionTimeMs = Math.round(totalMs / humanResolvedConversations.length);
      }

      const humanResolutionRate =
        humanConversations > 0 ? humanResolvedConversations.length / humanConversations : 0;

      return {
        ai: {
          conversationCount: aiConversations,
          avgResponseTimeMs: Math.round(aiResponseTime._avg.latencyMs || 0),
          avgResolutionTimeMs: aiAvgResolutionTimeMs,
          avgCSAT: Math.round((aiCSAT._avg.rating || 0) * 100) / 100,
          resolutionRate: Math.round(aiResolutionRate * 100) / 100,
        },
        human: {
          conversationCount: humanConversations,
          avgResponseTimeMs: Math.round(humanResponseTime._avg.latencyMs || 0),
          avgResolutionTimeMs: humanAvgResolutionTimeMs,
          avgCSAT: Math.round((humanCSAT._avg.rating || 0) * 100) / 100,
          resolutionRate: Math.round(humanResolutionRate * 100) / 100,
        },
      };
    });
  }
}

export const teamPerformanceService = new TeamPerformanceService();
