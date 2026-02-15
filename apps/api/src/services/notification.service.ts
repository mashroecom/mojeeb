import { prisma } from '../config/database';
import { NotFoundError } from '../utils/errors';

export class NotificationService {
  /**
   * List notifications for a user within an organization (paginated).
   */
  async list(
    userId: string,
    orgId: string,
    params: { page?: number; limit?: number; unreadOnly?: boolean },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId, orgId };
    if (params.unreadOnly) {
      where.isRead = false;
    }

    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get the count of unread notifications for a user within an organization.
   */
  async getUnreadCount(userId: string, orgId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, orgId, isRead: false },
    });
  }

  /**
   * Mark a single notification as read.
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new NotFoundError('Notification not found');

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications as read for a user within an organization.
   */
  async markAllAsRead(userId: string, orgId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, orgId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Create a single notification.
   */
  async create(data: {
    orgId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    metadata?: any;
  }) {
    return prisma.notification.create({ data });
  }

  /**
   * Create a notification for ALL members of an organization.
   * Useful for org-wide events (e.g. new conversation, usage warning).
   */
  async createForOrgMembers(data: {
    orgId: string;
    type: string;
    title: string;
    body: string;
    metadata?: any;
  }): Promise<void> {
    const members = await prisma.orgMembership.findMany({
      where: { orgId: data.orgId },
      select: { userId: true },
    });

    if (members.length === 0) return;

    await prisma.notification.createMany({
      data: members.map((member) => ({
        orgId: data.orgId,
        userId: member.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        metadata: data.metadata ?? undefined,
      })),
    });
  }

  /**
   * Delete a single notification.
   */
  async delete(userId: string, notificationId: string): Promise<void> {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new NotFoundError('Notification not found');

    await prisma.notification.delete({ where: { id: notificationId } });
  }

  /**
   * Get notification preferences for a user within an organization.
   * Creates defaults if they don't exist yet.
   */
  async getPreferences(userId: string, orgId: string) {
    return prisma.notificationPreference.upsert({
      where: { orgId_userId: { orgId, userId } },
      update: {},
      create: { orgId, userId },
    });
  }

  /**
   * Update notification preferences for a user within an organization.
   */
  async updatePreferences(
    userId: string,
    orgId: string,
    data: {
      emailNewConversation?: boolean;
      emailHandoff?: boolean;
      emailLeadExtracted?: boolean;
      emailUsageWarning?: boolean;
      emailWeeklyDigest?: boolean;
    },
  ) {
    return prisma.notificationPreference.upsert({
      where: { orgId_userId: { orgId, userId } },
      update: data,
      create: { orgId, userId, ...data },
    });
  }
}

export const notificationService = new NotificationService();
