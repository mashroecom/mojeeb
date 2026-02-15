import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { cache } from '../config/cache';
import { NotFoundError } from '../utils/errors';
import { subscriptionService } from './subscription.service';

export class AgentService {
  async create(orgId: string, data: {
    name: string;
    description?: string;
    aiProvider?: string;
    aiModel?: string;
    systemPrompt?: string;
    templateType?: string;
    temperature?: number;
    maxTokens?: number;
    language?: string;
    enableEmotionDetection?: boolean;
    enableLeadExtraction?: boolean;
    enableHumanHandoff?: boolean;
    handoffThreshold?: number;
  }) {
    // Check limit and increment agent usage counter
    await subscriptionService.incrementUsage(orgId, 'agents');

    const defaultPrompt = 'You are a helpful AI assistant. Answer questions clearly and professionally.';

    return prisma.agent.create({
      data: {
        orgId,
        name: data.name,
        description: data.description,
        aiProvider: (data.aiProvider ?? 'OPENAI') as any,
        aiModel: data.aiModel ?? 'gpt-4o',
        systemPrompt: data.systemPrompt || defaultPrompt,
        templateType: data.templateType,
        temperature: data.temperature ?? 0.7,
        maxTokens: data.maxTokens ?? 1024,
        language: data.language ?? 'ar',
        enableEmotionDetection: data.enableEmotionDetection ?? true,
        enableLeadExtraction: data.enableLeadExtraction ?? false,
        enableHumanHandoff: data.enableHumanHandoff ?? true,
        handoffThreshold: data.handoffThreshold ?? 0.3,
      },
    });
  }

  async list(orgId: string) {
    return prisma.agent.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        knowledgeBases: { include: { knowledgeBase: { select: { id: true, name: true } } } },
        channels: { include: { channel: { select: { id: true, name: true, type: true } } } },
        _count: { select: { conversations: true } },
      },
    });
  }

  async getById(orgId: string, agentId: string) {
    return cache.getOrSet(`agent:${agentId}`, 300, async () => {
      const agent = await prisma.agent.findFirst({
        where: { id: agentId, orgId },
        include: {
          knowledgeBases: { include: { knowledgeBase: true } },
          channels: { include: { channel: true } },
          _count: { select: { conversations: true } },
        },
      });
      if (!agent) throw new NotFoundError('Agent not found');
      return agent;
    });
  }

  async update(orgId: string, agentId: string, data: Partial<{
    name: string;
    description: string;
    aiProvider: string;
    aiModel: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    language: string;
    isActive: boolean;
    enableEmotionDetection: boolean;
    enableLeadExtraction: boolean;
    enableHumanHandoff: boolean;
    handoffThreshold: number;
  }>) {
    const agent = await prisma.agent.findFirst({ where: { id: agentId, orgId } });
    if (!agent) throw new NotFoundError('Agent not found');

    const updated = await prisma.agent.update({
      where: { id: agentId },
      data: data as any,
    });

    await cache.del(`agent:${agentId}`);

    return updated;
  }

  async delete(orgId: string, agentId: string) {
    const agent = await prisma.agent.findFirst({ where: { id: agentId, orgId } });
    if (!agent) throw new NotFoundError('Agent not found');

    await prisma.agent.delete({ where: { id: agentId } });
    await cache.del(`agent:${agentId}`);

    // Decrement agent usage counter
    await subscriptionService.decrementUsage(orgId, 'agents');
  }

  /**
   * Link a knowledge base to an agent.
   */
  async linkKnowledgeBase(orgId: string, agentId: string, knowledgeBaseId: string) {
    const agent = await prisma.agent.findFirst({ where: { id: agentId, orgId } });
    if (!agent) throw new NotFoundError('Agent not found');

    const kb = await prisma.knowledgeBase.findFirst({ where: { id: knowledgeBaseId, orgId } });
    if (!kb) throw new NotFoundError('Knowledge base not found');

    const link = await prisma.agentKnowledgeBase.upsert({
      where: { agentId_knowledgeBaseId: { agentId, knowledgeBaseId } },
      create: { agentId, knowledgeBaseId },
      update: {},
      include: { knowledgeBase: { select: { id: true, name: true } } },
    });
    await cache.del(`agent:${agentId}`);
    return link;
  }

  /**
   * Unlink a knowledge base from an agent.
   */
  async unlinkKnowledgeBase(orgId: string, agentId: string, knowledgeBaseId: string) {
    const agent = await prisma.agent.findFirst({ where: { id: agentId, orgId } });
    if (!agent) throw new NotFoundError('Agent not found');

    const link = await prisma.agentKnowledgeBase.findUnique({
      where: { agentId_knowledgeBaseId: { agentId, knowledgeBaseId } },
    });
    if (!link) throw new NotFoundError('Knowledge base not linked to this agent');

    await prisma.agentKnowledgeBase.delete({
      where: { agentId_knowledgeBaseId: { agentId, knowledgeBaseId } },
    });
    await cache.del(`agent:${agentId}`);
  }

  async test(
    orgId: string,
    agentId: string,
    message: string,
    history?: { role: 'user' | 'assistant'; content: string }[],
  ) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: { knowledgeBases: true },
    });
    if (!agent) throw new NotFoundError('Agent not found');

    const { getAIProvider } = await import('../ai/index');
    const { buildSystemPrompt } = await import('../ai/prompts/system');

    const provider = getAIProvider(agent.aiProvider);

    // Retrieve knowledge base context using vector search (same as production)
    const kbContext = await this.retrieveKBContext(agent, message, provider);

    const systemPrompt = buildSystemPrompt({
      agentName: agent.name,
      agentDescription: agent.description || undefined,
      language: agent.language,
      knowledgeContext: kbContext,
      customInstructions: agent.systemPrompt,
    });

    const messages = [
      ...(history ?? []),
      { role: 'user' as const, content: message },
    ];

    const response = await provider.generateResponse({
      systemPrompt,
      messages,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    });

    // Increment message usage (test messages consume tokens too)
    await prisma.subscription.updateMany({
      where: { orgId },
      data: { messagesUsed: { increment: 1 } },
    });

    return { reply: response.content, tokensUsed: response.tokensUsed };
  }

  /**
   * Retrieve relevant knowledge base chunks via pgvector similarity search.
   */
  private async retrieveKBContext(
    agent: { knowledgeBases: { knowledgeBaseId: string }[] },
    query: string,
    provider: any,
  ): Promise<string> {
    const kbIds = agent.knowledgeBases.map((kb) => kb.knowledgeBaseId);
    if (kbIds.length === 0) return '';

    try {
      const queryEmbedding = await provider.generateEmbedding(query);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      const chunks = await prisma.$queryRaw<Array<{ content: string; similarity: number }>>`
        SELECT c.content,
               1 - (c.embedding <=> ${embeddingStr}::vector) as similarity
        FROM kb_chunks c
        JOIN kb_documents d ON c."documentId" = d.id
        WHERE d."knowledgeBaseId" IN (${Prisma.join(kbIds)})
          AND d."embeddingStatus" = 'COMPLETED'
          AND c.embedding IS NOT NULL
        ORDER BY c.embedding <=> ${embeddingStr}::vector
        LIMIT 3
      `;

      if (chunks.length === 0) return '';
      return chunks.map((c) => c.content).join('\n\n---\n\n');
    } catch (err) {
      logger.error({ err }, 'Failed to retrieve KB context in test mode');
      return '';
    }
  }
}

export const agentService = new AgentService();
