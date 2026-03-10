import { Worker } from 'bullmq';
import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { outboundQueue, analyticsQueue } from '../index';
import { moveToDeadLetterQueue } from '../dlq';
import { responsePipeline } from '../../ai/pipelines/response.pipeline';
import { summaryPipeline } from '../../ai/pipelines/summary.pipeline';
import { emitToOrg, emitToConversation } from '../../websocket/index';
import { tokenUsageService } from '../../services/tokenUsage.service';
import { notificationService } from '../../services/notification.service';
import { webhookService } from '../../services/webhook.service';
import { aiConversationTrackingService } from '../../services/aiConversationTracking.service';
import { pushNotificationService } from '../../services/pushNotification.service';

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

    try {
    // Load agent with knowledge bases
    const agent = await prisma.agent.findUnique({
      where: { id: data.agentId },
      include: { knowledgeBases: true },
    });

    if (!agent || !agent.isActive) {
      logger.warn({ agentId: data.agentId }, 'Agent not found or inactive');
      return;
    }

    // Double-check: skip AI if conversation was handed off (race condition guard)
    const convCheck = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
      select: { status: true },
    });
    if (convCheck?.status === 'HANDED_OFF') {
      logger.info({ conversationId: data.conversationId }, 'Skipping AI — conversation already HANDED_OFF');
      return;
    }

    // Generate response
    const result = await responsePipeline.generate({
      conversationId: data.conversationId,
      incomingMessage: data.customerMessage,
      incomingMessageContentType: data.customerMessageContentType || 'TEXT',
      agent: agent as any,
    });

    const latencyMs = Date.now() - startTime;
    const isHandoff = result.routingDecision.shouldHandoff;

    // Track token usage (always, regardless of handoff)
    try {
      await tokenUsageService.record({
        orgId: data.orgId,
        agentId: data.agentId,
        conversationId: data.conversationId,
        model: agent.aiModel,
        provider: agent.aiProvider,
        inputTokens: result.aiResponse.tokensUsed.prompt || 0,
        outputTokens: result.aiResponse.tokensUsed.completion || 0,
        pipelineType: 'response',
      });
    } catch (err) {
      logger.warn({ err }, 'Token usage tracking failed');
    }

    // Update conversation
    const updateData: Record<string, unknown> = {
      messageCount: { increment: 1 },
      lastMessageAt: new Date(),
    };

    if (result.emotion) {
      updateData.lastEmotion = result.emotion.emotion;
      updateData.emotionScore = result.emotion.score;
    }

    // --- ESCALATION PATH: hand off to human, do NOT send AI text ---
    if (isHandoff) {
      updateData.status = 'HANDED_OFF';
      const reason = result.routingDecision.reason;
      logger.info({ conversationId: data.conversationId, reason }, 'Escalating conversation to human agent');

      // 1) Customer-facing message — simple, friendly, no internal details
      const customerContent = agent.language === 'ar'
        ? 'تم تحويلك للدعم البشري، سيتم الرد عليك قريباً ⏳'
        : "You've been connected to our support team. Someone will be with you shortly ⏳";
      const customerMsg = await prisma.message.create({
        data: {
          conversationId: data.conversationId,
          role: 'SYSTEM',
          content: customerContent,
          contentType: 'TEXT',
          metadata: { action: 'escalation', visibility: 'customer' },
        },
      });

      // 2) Internal message — full details with reason (agents/admins only)
      let localizedReason = reason;
      if (agent.language === 'ar') {
        const reasonMap: Record<string, string> = {
          'Customer explicitly requested human agent': 'العميل طلب التحدث مع موظف',
          'Customer repeating same message - AI likely unhelpful': 'العميل يكرر نفس الرسالة',
          'Routing check failed': 'فشل التحقق من التوجيه',
        };
        if (reasonMap[reason]) {
          localizedReason = reasonMap[reason];
        } else if (reason.startsWith('High ') || reason.includes('detected with score')) {
          localizedReason = 'تم رصد مستوى عالٍ من الانزعاج';
        } else if (reason.startsWith('Escalation keyword')) {
          localizedReason = `تم رصد كلمة تصعيد: ${reason.split('"')[1] || reason}`;
        }
      }
      const internalContent = agent.language === 'ar'
        ? `تم تحويل المحادثة إلى وكيل بشري. السبب: ${localizedReason}`
        : `Conversation handed off to human agent. Reason: ${reason}`;
      const internalMsg = await prisma.message.create({
        data: {
          conversationId: data.conversationId,
          role: 'SYSTEM',
          content: internalContent,
          contentType: 'TEXT',
          metadata: { action: 'escalation', visibility: 'internal', reason },
        },
      });

      // Update conversation status BEFORE emitting events
      const updatedConversation = await prisma.conversation.update({
        where: { id: data.conversationId },
        data: updateData,
      });

      // Emit customer-facing message to both namespaces (widget + dashboard)
      const customerWsPayload = {
        messageId: customerMsg.id,
        conversationId: data.conversationId,
        role: 'SYSTEM',
        content: customerContent,
        contentType: 'TEXT',
        metadata: { action: 'escalation', visibility: 'customer' },
        createdAt: customerMsg.createdAt,
      };
      emitToOrg(data.orgId, 'message:new', customerWsPayload);
      emitToConversation(data.conversationId, 'message:new', customerWsPayload);

      // Emit internal message to dashboard only (NOT to webchat/widget)
      const internalWsPayload = {
        messageId: internalMsg.id,
        conversationId: data.conversationId,
        role: 'SYSTEM',
        content: internalContent,
        contentType: 'TEXT',
        metadata: { action: 'escalation', visibility: 'internal', reason },
        createdAt: internalMsg.createdAt,
      };
      emitToOrg(data.orgId, 'message:new', internalWsPayload);

      // Emit conversation status update
      const updatePayload = {
        conversationId: data.conversationId,
        status: 'HANDED_OFF',
        emotion: result.emotion?.emotion,
        emotionScore: result.emotion?.score,
      };
      emitToOrg(data.orgId, 'conversation:updated', updatePayload);
      emitToConversation(data.conversationId, 'conversation:updated', updatePayload);

      try {
        await analyticsQueue.add('track-event', {
          orgId: data.orgId,
          eventType: 'HUMAN_HANDOFF',
          data: { conversationId: data.conversationId, reason },
        });

        await analyticsQueue.add('track-event', {
          orgId: data.orgId,
          eventType: 'AI_RESPONSE_GENERATED',
          data: {
            conversationId: data.conversationId,
            latencyMs,
            tokensUsed: result.aiResponse.tokensUsed.total,
            agentId: data.agentId,
            handoff: true,
          },
          agentId: data.agentId,
        });
      } catch (analyticsErr) {
        logger.warn({ err: analyticsErr }, 'Failed to queue handoff analytics');
      }

      // Notify org members about the handoff (in-app notification)
      try {
        const notifTitle = agent.language === 'ar'
          ? 'محادثة تحتاج تدخل بشري'
          : 'Conversation needs human agent';
        const notifBody = agent.language === 'ar'
          ? `تم تحويل محادثة إلى الدعم البشري. السبب: ${localizedReason}`
          : `A conversation has been escalated to human support. Reason: ${reason}`;

        await notificationService.createForOrgMembers({
          orgId: data.orgId,
          type: 'HANDOFF',
          title: notifTitle,
          body: notifBody,
          metadata: { conversationId: data.conversationId, reason },
        });
      } catch (notifErr) {
        logger.warn({ err: notifErr }, 'Failed to create handoff notification');
      }

      // Send push notifications for handoff
      try {
        await pushNotificationService.notifyHandoff({
          orgId: data.orgId,
          conversationId: data.conversationId,
        });
      } catch (pushErr) {
        logger.warn({ err: pushErr }, 'Failed to send handoff push notification');
      }

      // Send escalation push notification for high-priority cases
      try {
        const isHighPriorityEscalation =
          result.emotion &&
          ['angry', 'frustrated'].includes(result.emotion.emotion) &&
          result.emotion.score > 0.8;

        const isEscalationKeyword = reason.includes('Escalation keyword');

        if (isHighPriorityEscalation || isEscalationKeyword) {
          await pushNotificationService.notifyEscalation({
            orgId: data.orgId,
            conversationId: data.conversationId,
            priority: isHighPriorityEscalation ? 'urgent' : 'high',
          });
        }
      } catch (escalationErr) {
        logger.warn({ err: escalationErr }, 'Failed to send escalation push notification');
      }

      // DO NOT create AI message, DO NOT queue outbound — escalation only
      return {
        messageId: customerMsg.id,
        handoff: true,
        emotion: result.emotion?.emotion,
      };
    }

    // --- NORMAL PATH: no escalation, send AI response ---
    const quickReplies = result.quickReplies || [];
    const msgMeta = quickReplies.length > 0 ? { quickReplies } : undefined;

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
        metadata: msgMeta as any,
      },
    });

    const updatedConversation = await prisma.conversation.update({
      where: { id: data.conversationId },
      data: updateData,
    });

    // Generate enhanced summary every 3 messages
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
        const enhancedSummary = await summaryPipeline.generate(mapped);
        if (enhancedSummary) {
          await prisma.conversation.update({
            where: { id: data.conversationId },
            data: {
              summary: enhancedSummary.summary,
              topics: enhancedSummary.topics,
              customerIntent: enhancedSummary.customerIntent,
              resolutionStatus: enhancedSummary.resolutionStatus,
              category: result.category || undefined,
            },
          });
        }
      } catch (err) {
        logger.warn({ err, conversationId: data.conversationId }, 'Enhanced summary generation failed');
      }
    }

    // Emit real-time WebSocket events for AI message
    try {
      const wsPayload = {
        messageId: aiMessage.id,
        conversationId: data.conversationId,
        role: aiMessage.role,
        content: aiMessage.content,
        contentType: aiMessage.contentType,
        createdAt: aiMessage.createdAt,
        metadata: aiMessage.metadata,
        quickReplies: result.quickReplies || [],
      };
      emitToOrg(data.orgId, 'message:new', wsPayload);
      emitToConversation(data.conversationId, 'message:new', wsPayload);
      if (result.emotion) {
        const updatePayload = {
          conversationId: data.conversationId,
          emotion: result.emotion?.emotion,
          emotionScore: result.emotion?.score,
        };
        emitToOrg(data.orgId, 'conversation:updated', updatePayload);
        emitToConversation(data.conversationId, 'conversation:updated', updatePayload);
      }
    } catch (wsErr) {
      logger.warn({ err: wsErr }, 'Failed to emit WebSocket events from AI worker');
    }

    // Save extracted customer data to conversation
    if (result.extractedData) {
      try {
        const currentConv = await prisma.conversation.findUnique({
          where: { id: data.conversationId },
          select: {
            customerName: true,
            customerEmail: true,
            customerPhone: true,
            customerMeta: true,
          },
        });

        const dataUpdate: Record<string, unknown> = {};
        const ed = result.extractedData;

        // Only update fields that are newly extracted and not already set
        if (ed.name && !currentConv?.customerName) dataUpdate.customerName = ed.name;
        if (ed.email && !currentConv?.customerEmail) dataUpdate.customerEmail = ed.email;
        if (ed.phone && !currentConv?.customerPhone) dataUpdate.customerPhone = ed.phone;

        // Store company, address, orderNumber in customerMeta
        const existingMeta = (currentConv?.customerMeta as Record<string, string>) || {};
        const metaUpdates: Record<string, string> = {};
        if (ed.company && !existingMeta.company) metaUpdates.company = ed.company;
        if (ed.address && !existingMeta.address) metaUpdates.address = ed.address;
        if (ed.orderNumber && !existingMeta.orderNumber) metaUpdates.orderNumber = ed.orderNumber;

        if (Object.keys(metaUpdates).length > 0) {
          dataUpdate.customerMeta = { ...existingMeta, ...metaUpdates };
        }

        if (Object.keys(dataUpdate).length > 0) {
          await prisma.conversation.update({
            where: { id: data.conversationId },
            data: dataUpdate,
          });
          logger.info(
            { conversationId: data.conversationId, fields: Object.keys(dataUpdate) },
            'Customer data saved from extraction',
          );
        }
      } catch (err) {
        logger.warn({ err, conversationId: data.conversationId }, 'Customer data extraction save failed');
      }
    }

    // Handle lead extraction
    if (result.lead) {
      try {
        const lead = await prisma.lead.create({
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

        await webhookService.dispatch(data.orgId, 'lead.created', lead);

        await analyticsQueue.add('track-event', {
          orgId: data.orgId,
          eventType: 'LEAD_EXTRACTED',
          data: { conversationId: data.conversationId },
        });
      } catch (leadErr) {
        logger.warn({ err: leadErr, conversationId: data.conversationId }, 'Lead extraction save failed');
      }
    }

    // Track AI conversation (first AI response in conversation)
    try {
      // Check if this is the first AI response in the conversation
      const previousAiMessages = await prisma.message.count({
        where: {
          conversationId: data.conversationId,
          role: 'AI_AGENT',
          id: { not: aiMessage.id }, // Exclude the message we just created
        },
      });

      if (previousAiMessages === 0) {
        // This is the first AI response, increment AI conversation counter
        await aiConversationTrackingService.incrementAiConversation(data.orgId);
        logger.info({ orgId: data.orgId, conversationId: data.conversationId }, 'AI conversation tracked');
      }
    } catch (trackingErr) {
      logger.warn({ err: trackingErr }, 'AI conversation tracking failed');
    }

    // Track events (non-critical — don't fail the job if analytics queue is down)
    try {
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
    } catch (analyticsErr) {
      logger.warn({ err: analyticsErr }, 'Failed to queue analytics events');
    }

    // Queue outbound message (send reply to customer)
    await outboundQueue.add('send-message', {
      conversationId: data.conversationId,
      messageId: aiMessage.id,
      channelType: data.channelType,
      channelId: data.channelId,
      content: result.aiResponse.content,
      contentType: 'TEXT',
    });

    return {
      messageId: aiMessage.id,
      handoff: false,
      emotion: result.emotion?.emotion,
    };
    } catch (pipelineErr) {
      // Send fallback message on pipeline failure
      try {
        const org = await prisma.organization.findUnique({
          where: { id: data.orgId },
          select: { fallbackMessage: true, fallbackMessageAr: true, defaultLanguage: true },
        });
        const fallback = org?.defaultLanguage === 'ar' ? org?.fallbackMessageAr : org?.fallbackMessage;
        if (fallback) {
          const fallbackMsg = await prisma.message.create({
            data: {
              conversationId: data.conversationId,
              role: 'AI_AGENT',
              content: fallback,
              contentType: 'TEXT',
            },
          });
          const wsPayload = {
            messageId: fallbackMsg.id,
            conversationId: data.conversationId,
            role: 'AI_AGENT',
            content: fallback,
            contentType: 'TEXT',
            createdAt: fallbackMsg.createdAt,
          };
          emitToConversation(data.conversationId, 'message:new', wsPayload);
          emitToOrg(data.orgId, 'message:new', wsPayload);
        }
      } catch (fbErr) {
        logger.warn({ err: fbErr }, 'Fallback message failed');
      }
      throw pipelineErr;
    }
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
