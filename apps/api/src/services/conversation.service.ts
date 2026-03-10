import { prisma } from '../config/database';
import { ConversationStatus } from '@prisma/client';
import { NotFoundError } from '../utils/errors';
import { webhookService } from './webhook.service';
import { pushNotificationService } from './pushNotification.service';

export class ConversationService {
  async list(orgId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
    channelId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    sentiment?: string;
    category?: string;
  }) {
    const page = Math.max(params.page || 1, 1);
    const limit = Math.min(Math.max(params.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { orgId };
    if (params.status) where.status = params.status;
    if (params.channelId) where.channelId = params.channelId;

    // Date range filters
    if (params.startDate || params.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (params.startDate) dateFilter.gte = new Date(params.startDate);
      if (params.endDate) dateFilter.lte = new Date(params.endDate);
      where.createdAt = dateFilter;
    }

    // Sentiment filter — maps sentiment category to emotion values
    if (params.sentiment) {
      const sentimentMap: Record<string, string[]> = {
        positive: ['happy', 'satisfied', 'grateful', 'excited', 'joy'],
        negative: ['angry', 'frustrated', 'sad', 'disappointed', 'annoyed', 'upset'],
        neutral: ['neutral', 'curious', 'confused'],
      };
      const emotions = sentimentMap[params.sentiment];
      if (emotions) {
        where.lastEmotion = { in: emotions };
      }
    }

    if (params.category) {
      where.category = params.category;
    }

    if (params.search) {
      where.OR = [
        { customerName: { contains: params.search, mode: 'insensitive' } },
        { summary: { contains: params.search, mode: 'insensitive' } },
        { customerEmail: { contains: params.search, mode: 'insensitive' } },
        { customerPhone: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
        include: {
          channel: { select: { type: true, name: true } },
          agent: { select: { name: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, role: true, createdAt: true },
          },
          tags: { include: { tag: true } },
          ratings: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { rating: true },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    return {
      conversations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(orgId: string, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, orgId },
      include: {
        channel: true,
        agent: true,
        leads: true,
        tags: { include: { tag: true } },
      },
    });
    if (!conversation) throw new NotFoundError('Conversation not found');
    return conversation;
  }

  async getMessages(conversationId: string, params: {
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(params.page || 1, 1);
    const limit = Math.min(Math.max(params.limit || 50, 1), 100);
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.message.count({ where: { conversationId } }),
    ]);

    return {
      messages,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async sendHumanMessage(conversationId: string, userId: string, content: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundError('Conversation not found');

    const message = await prisma.message.create({
      data: {
        conversationId,
        role: 'HUMAN_AGENT',
        content,
        contentType: 'TEXT',
        humanAgentId: userId,
      },
    });

    // Keep HANDED_OFF status — only "Return to AI" button should change it back
    const updateData: Record<string, unknown> = {
      messageCount: { increment: 1 },
      lastMessageAt: new Date(),
    };
    if (conversation.status !== 'HANDED_OFF') {
      updateData.status = 'ACTIVE';
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    return message;
  }

  async handoff(conversationId: string, userId: string) {
    const result = await prisma.conversation.updateMany({
      where: { id: conversationId, status: { in: ['ACTIVE', 'WAITING'] } },
      data: {
        status: 'HANDED_OFF',
        assignedToHuman: userId,
      },
    });
    if (result.count === 0) {
      throw new NotFoundError('Conversation not found or already handed off');
    }
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });

    // Send push notification for manual handoff
    if (conversation) {
      try {
        await pushNotificationService.notifyHandoff({
          orgId: conversation.orgId,
          conversationId: conversationId,
          toAgentId: userId,
        });
      } catch (err) {
        // Log but don't fail the handoff
      }
    }

    return conversation;
  }

  async resolve(conversationId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundError('Conversation not found');

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    await webhookService.dispatch(conversation.orgId, 'conversation.closed', updated);

    return updated;
  }

  async returnToAI(conversationId: string) {
    return prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'ACTIVE',
        assignedToHuman: null,
      },
    });
  }

  async archive(orgId: string, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, orgId },
    });
    if (!conversation) throw new NotFoundError('Conversation not found');

    return prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'ARCHIVED' },
    });
  }

  async bulkArchive(orgId: string, conversationIds: string[]) {
    const result = await prisma.conversation.updateMany({
      where: {
        id: { in: conversationIds },
        orgId,
      },
      data: { status: 'ARCHIVED' },
    });

    return { archivedCount: result.count };
  }

  async bulkUpdateStatus(orgId: string, conversationIds: string[], status: ConversationStatus) {
    const result = await prisma.conversation.updateMany({
      where: {
        id: { in: conversationIds },
        orgId,
      },
      data: { status },
    });

    return { updatedCount: result.count };
  }

  async delete(orgId: string, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, orgId },
    });
    if (!conversation) throw new NotFoundError('Conversation not found');

    await prisma.$transaction([
      prisma.conversationTag.deleteMany({ where: { conversationId } }),
      prisma.conversationRating.deleteMany({ where: { conversationId } }),
      prisma.conversationNote.deleteMany({ where: { conversationId } }),
      prisma.message.deleteMany({ where: { conversationId } }),
      prisma.lead.deleteMany({ where: { conversationId } }),
      prisma.conversation.delete({ where: { id: conversationId } }),
    ]);

    return conversation;
  }

  async bulkDelete(orgId: string, conversationIds: string[]) {
    const result = await prisma.$transaction([
      prisma.conversationTag.deleteMany({
        where: { conversationId: { in: conversationIds } }
      }),
      prisma.conversationRating.deleteMany({
        where: { conversationId: { in: conversationIds } }
      }),
      prisma.conversationNote.deleteMany({
        where: { conversationId: { in: conversationIds } }
      }),
      prisma.message.deleteMany({
        where: { conversationId: { in: conversationIds } }
      }),
      prisma.lead.deleteMany({
        where: { conversationId: { in: conversationIds } }
      }),
      prisma.conversation.deleteMany({
        where: {
          id: { in: conversationIds },
          orgId
        }
      }),
    ]);

    return { deletedCount: result[5].count };
  }
}

export const conversationService = new ConversationService();
