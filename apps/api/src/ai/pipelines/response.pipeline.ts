import { Prisma } from '@prisma/client';
import { getAIProvider } from '../index';
import { buildSystemPrompt } from '../prompts/system';
import { analysisPipeline } from './analysis.pipeline';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import type {
  AIResponse,
  EmotionResult,
  RoutingDecision,
  LeadResult,
  ConversationMessage,
  ContentPart,
} from '@mojeeb/shared-types';
import { imageToBase64DataUrl, isSupportedImageFile } from '../utils/image.utils';

interface Agent {
  id: string;
  name: string;
  description: string | null;
  aiProvider: string;
  aiModel: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  language: string;
  enableEmotionDetection: boolean;
  enableLeadExtraction: boolean;
  enableHumanHandoff: boolean;
  handoffThreshold: number;
  knowledgeBases: { knowledgeBaseId: string }[];
}

interface ResponseResult {
  aiResponse: AIResponse;
  emotion: EmotionResult | null;
  routingDecision: RoutingDecision;
  lead: LeadResult | null;
}

export class ResponsePipeline {
  async generate(params: {
    conversationId: string;
    incomingMessage: string;
    incomingMessageContentType?: string;
    agent: Agent;
  }): Promise<ResponseResult> {
    const startTime = Date.now();

    // 1. Load conversation context (last 10 messages — reduced from 20)
    const messages = await prisma.message.findMany({
      where: { conversationId: params.conversationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { role: true, content: true, contentType: true },
    });

    const filteredMessages = messages
      .reverse()
      .filter((m) => m.role !== 'SYSTEM'); // Exclude system messages (handoff notices etc.)

    // Build multimodal context messages (images as vision content)
    const contextMessages: ConversationMessage[] = await Promise.all(
      filteredMessages.map(async (m) => ({
        role: m.role === 'CUSTOMER' ? ('user' as const) : ('assistant' as const),
        content: await this.buildMessageContent(m.content, m.contentType),
      }))
    );

    // Build text-only messages for analysis pipeline (no vision tokens)
    const textOnlyMessages: ConversationMessage[] = filteredMessages.map((m) => ({
      role: m.role === 'CUSTOMER' ? ('user' as const) : ('assistant' as const),
      content: this.annotateContentText(m.content, m.contentType),
    }));

    // Add the new incoming message
    const incomingContentType = params.incomingMessageContentType || 'TEXT';
    const incomingContent = await this.buildMessageContent(
      params.incomingMessage,
      incomingContentType
    );
    contextMessages.push({ role: 'user', content: incomingContent });

    // Text-only version for analysis
    const annotatedMessage = this.annotateContentText(
      params.incomingMessage,
      incomingContentType
    );
    textOnlyMessages.push({ role: 'user', content: annotatedMessage });

    // 2. Retrieve knowledge base context + last known emotion in parallel
    const [kbContext, conversation] = await Promise.all([
      this.retrieveKBContext(params.agent, params.incomingMessage),
      prisma.conversation.findUnique({
        where: { id: params.conversationId },
        select: { lastEmotion: true, emotionScore: true },
      }),
    ]);

    // 3. Build system prompt (with emotion-aware tone)
    const systemPrompt = buildSystemPrompt({
      agentName: params.agent.name,
      agentDescription: params.agent.description || undefined,
      language: params.agent.language,
      knowledgeContext: kbContext,
      customInstructions: params.agent.systemPrompt,
      customerEmotion: conversation?.lastEmotion || undefined,
      emotionScore: conversation?.emotionScore || undefined,
    });

    // 4. Generate AI response + run combined analysis in parallel
    //    Main response uses agent's model; analysis uses gpt-4o-mini (single call)
    const provider = getAIProvider(params.agent.aiProvider);

    const [aiResponse, analysis] = await Promise.all([
      provider.generateResponse({
        systemPrompt,
        messages: contextMessages,
        temperature: params.agent.temperature,
        maxTokens: params.agent.maxTokens,
        model: params.agent.aiModel,
      }),
      analysisPipeline.analyze(
        annotatedMessage,
        textOnlyMessages,
        {
          enableEmotion: params.agent.enableEmotionDetection,
          enableLead: params.agent.enableLeadExtraction,
          enableRouting: params.agent.enableHumanHandoff,
          handoffThreshold: params.agent.handoffThreshold,
          language: params.agent.language,
          agentDescription: params.agent.description || undefined,
          agentName: params.agent.name,
        },
      ),
    ]);

    const latencyMs = Date.now() - startTime;
    logger.info(
      { conversationId: params.conversationId, latencyMs, tokensUsed: aiResponse.tokensUsed.total },
      'AI response generated'
    );

    return {
      aiResponse,
      emotion: analysis.emotion,
      routingDecision: analysis.routing,
      lead: analysis.lead,
    };
  }

  private async buildMessageContent(
    content: string,
    contentType: string
  ): Promise<string | ContentPart[]> {
    if (contentType === 'IMAGE' && isSupportedImageFile(content)) {
      const result = await imageToBase64DataUrl(content);
      if (result) {
        return [
          {
            type: 'image_url',
            imageUrl: result.dataUrl,
            mimeType: result.mimeType,
            detail: 'auto',
          },
        ];
      }
      // Fallback if image read fails
      return `[العميل أرسل صورة: ${content}]`;
    }

    return this.annotateContentText(content, contentType);
  }

  private annotateContentText(content: string, contentType: string): string {
    switch (contentType) {
      case 'IMAGE':
        return `[العميل أرسل صورة: ${content}]`;
      case 'VIDEO':
        return `[العميل أرسل فيديو: ${content}]`;
      case 'AUDIO':
        return `[العميل أرسل ملف صوتي: ${content}]`;
      case 'DOCUMENT':
        return `[العميل أرسل مستند: ${content}]`;
      default:
        return content;
    }
  }

  private async retrieveKBContext(
    agent: Agent,
    query: string
  ): Promise<string> {
    const kbIds = agent.knowledgeBases.map((kb) => kb.knowledgeBaseId);
    if (kbIds.length === 0) return '';

    try {
      const provider = getAIProvider('OPENAI');
      const queryEmbedding = await provider.generateEmbedding(query);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // Top 3 chunks (reduced from 5 — saves ~40% KB tokens)
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
      logger.error({ err }, 'Failed to retrieve KB context');
      return '';
    }
  }
}

export const responsePipeline = new ResponsePipeline();
