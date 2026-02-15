import { Worker } from 'bullmq';
import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { outboundQueue, analyticsQueue } from '../index';
import { moveToDeadLetterQueue } from '../dlq';
import { responsePipeline } from '../../ai/pipelines/response.pipeline';
import { summaryPipeline } from '../../ai/pipelines/summary.pipeline';
import { emitToOrg, emitToConversation } from '../../websocket/index';

interface AIJobData {
  conversationId: string;
  messageId: string;
  agentId: string;
  orgId: string;
  channelId: string;
  channelType: string;
  customerMessage: string;
  customerMessageContentType?: string;
}

export const aiWorker = new Worker(
  'ai-processing',
  async (job) => {
    const data = job.data as AIJobData;
    const startTime = Date.now();
    logger.info({ jobId: job.id, conversationId: data.conversationId }, 'Processing AI response');

    // Load agent with knowledge bases
    const agent = await prisma.agent.findUnique({
      where: { id: data.agentId },
      include: { knowledgeBases: true },
    });

    if (!agent || !agent.isActive) {
      logger.warn({ agentId: data.agentId }, 'Agent not found or inactive');
      return;
    }

    // Generate response
    const result = await responsePipeline.generate({
      conversationId: data.conversationId,
      incomingMessage: data.customerMessage,
      incomingMessageContentType: data.customerMessageContentType || 'TEXT',
      agent,
    });

    const latencyMs = Date.now() - startTime;

    // Store AI response message
    const aiMessage = await prisma.message.create({
      data: {
        conversationId: data.conversationId,
        role: 'AI_AGENT',
        content: result.aiResponse.content,
        contentType: 'TEXT',
        aiProvider: agent.aiProvider,
        aiModel: agent.aiModel,
        tokenCount: result.aiResponse.tokensUsed.total,
        latencyMs,
        emotion: result.emotion?.emotion,
        emotionScore: result.emotion?.score,
        metadata: undefined,
      },
    });

    // Update conversation
    const updateData: Record<string, unknown> = {
      messageCount: { increment: 1 },
      lastMessageAt: new Date(),
    };

    if (result.emotion) {
      updateData.lastEmotion = result.emotion.emotion;
      updateData.emotionScore = result.emotion.score;
    }

    // Handle routing decision
    if (result.routingDecision.shouldHandoff) {
      updateData.status = 'HANDED_OFF';

      // Create system message about handoff (language-aware)
      const reason = result.routingDecision.reason;
      let localizedReason = reason;
      if (agent.language === 'ar') {
        const reasonMap: Record<string, string> = {
          'Customer explicitly requested human agent': 'العميل طلب التحدث مع موظف',
          'Customer repeating same message - AI likely unhelpful': 'العميل يكرر نفس الرسالة',
          'Routing check failed': 'فشل التحقق من التوجيه',
        };
        if (reasonMap[reason]) {
          localizedReason = reasonMap[reason];
        } else if (reason.startsWith('High ')) {
          localizedReason = 'تم رصد مستوى عالٍ من الانزعاج';
        }
      }
      const handoffContent = agent.language === 'ar'
        ? `تم تحويل المحادثة إلى وكيل بشري. السبب: ${localizedReason}`
        : `Conversation handed off to human agent. Reason: ${reason}`;
      const handoffMessage = await prisma.message.create({
        data: {
          conversationId: data.conversationId,
          role: 'SYSTEM',
          content: handoffContent,
          contentType: 'TEXT',
        },
      });

      // Emit handoff system message via WebSocket
      const handoffWsPayload = {
        messageId: handoffMessage.id,
        conversationId: data.conversationId,
        role: 'SYSTEM',
        content: handoffContent,
        contentType: 'TEXT',
        createdAt: handoffMessage.createdAt,
      };
      emitToOrg(data.orgId, 'message:new', handoffWsPayload);
      emitToConversation(data.conversationId, 'message:new', handoffWsPayload);

      await analyticsQueue.add('track-event', {
        orgId: data.orgId,
        eventType: 'HUMAN_HANDOFF',
        data: {
          conversationId: data.conversationId,
          reason: result.routingDecision.reason,
        },
      });
    }

    const updatedConversation = await prisma.conversation.update({
      where: { id: data.conversationId },
      data: updateData,
    });

    // Generate summary every 3 messages
    if (updatedConversation.messageCount % 3 === 0) {
      try {
        const recentMessages = await prisma.message.findMany({
          where: { conversationId: data.conversationId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { role: true, content: true },
        });
        const mapped = recentMessages.reverse().map((m) => ({
          role: (m.role === 'CUSTOMER' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        }));
        const summary = await summaryPipeline.generate(mapped);
        if (summary) {
          await prisma.conversation.update({
            where: { id: data.conversationId },
            data: { summary },
          });
        }
      } catch (err) {
        logger.warn({ err, conversationId: data.conversationId }, 'Summary generation failed');
      }
    }

    // Emit real-time WebSocket events
    try {
      const wsPayload = {
        messageId: aiMessage.id,
        conversationId: data.conversationId,
        role: aiMessage.role,
        content: aiMessage.content,
        contentType: aiMessage.contentType,
        createdAt: aiMessage.createdAt,
        metadata: aiMessage.metadata,
      };
      emitToOrg(data.orgId, 'message:new', wsPayload);
      emitToConversation(data.conversationId, 'message:new', wsPayload);
      if (result.emotion || result.routingDecision.shouldHandoff) {
        const updatePayload = {
          conversationId: data.conversationId,
          status: result.routingDecision.shouldHandoff ? 'HANDED_OFF' : undefined,
          emotion: result.emotion?.emotion,
          emotionScore: result.emotion?.score,
        };
        emitToOrg(data.orgId, 'conversation:updated', updatePayload);
        emitToConversation(data.conversationId, 'conversation:updated', updatePayload);
      }
    } catch (wsErr) {
      logger.warn({ err: wsErr }, 'Failed to emit WebSocket events from AI worker');
    }

    // Handle lead extraction
    if (result.lead) {
      await prisma.lead.create({
        data: {
          orgId: data.orgId,
          conversationId: data.conversationId,
          name: result.lead.name,
          email: result.lead.email,
          phone: result.lead.phone,
          company: result.lead.company,
          interests: result.lead.interests,
          budget: result.lead.budget,
          timeline: result.lead.timeline,
          notes: result.lead.notes,
          confidence: result.lead.confidence,
          source: data.channelType,
        },
      });

      await analyticsQueue.add('track-event', {
        orgId: data.orgId,
        eventType: 'LEAD_EXTRACTED',
        data: { conversationId: data.conversationId },
      });
    }

    // Track events
    if (result.emotion) {
      await analyticsQueue.add('track-event', {
        orgId: data.orgId,
        eventType: 'EMOTION_DETECTED',
        data: { emotion: result.emotion.emotion, score: result.emotion.score },
      });
    }

    await analyticsQueue.add('track-event', {
      orgId: data.orgId,
      eventType: 'AI_RESPONSE_GENERATED',
      data: {
        conversationId: data.conversationId,
        latencyMs,
        tokensUsed: result.aiResponse.tokensUsed.total,
        agentId: data.agentId,
      },
      agentId: data.agentId,
    });

    // Queue outbound message (send reply to customer)
    if (!result.routingDecision.shouldHandoff) {
      await outboundQueue.add('send-message', {
        conversationId: data.conversationId,
        messageId: aiMessage.id,
        channelType: data.channelType,
        channelId: data.channelId,
        content: result.aiResponse.content,
        contentType: 'TEXT',
      });
    }

    return {
      messageId: aiMessage.id,
      handoff: result.routingDecision.shouldHandoff,
      emotion: result.emotion?.emotion,
    };
  },
  {
    connection: redis,
    concurrency: 5,
    lockDuration: 120_000,
    stalledInterval: 60_000,
    lockRenewTime: 30_000,
  }
);

aiWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'AI processing failed');
  moveToDeadLetterQueue('ai-processing', job, err, 3);
});

aiWorker.on('error', (err) => {
  logger.error({ err }, 'AI worker error');
});
