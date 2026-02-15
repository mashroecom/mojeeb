import { prisma } from '../config/database';
import { logger } from '../config/logger';

export class AdminNotificationService {
  /**
   * Create a notification for all super-admin users.
   * Optionally emits a real-time event via websocket (fire-and-forget).
   */
  async create(params: {
    type: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) {
    const { type, title, body, metadata } = params;

    // Find all super admin users
    const admins = await prisma.user.findMany({
      where: { isSuperAdmin: true },
      select: { id: true },
    });

    if (admins.length === 0) {
      logger.warn('No super admin users found for notification');
      return [];
    }

    // Create a notification for each admin
    const notifications = await prisma.$transaction(
      admins.map((admin) =>
        prisma.adminNotification.create({
          data: {
            userId: admin.id,
            type,
            title,
            body,
            metadata: metadata as any ?? undefined,
          },
        }),
      ),
    );

    // Try to emit via websocket (fire-and-forget)
    try {
      const { emitToAdmin } = await import('../websocket');
      emitToAdmin('admin:notification', {
        type,
        title,
        body,
        metadata,
        createdAt: new Date(),
      });
    } catch {
      // Websocket not available yet — that's fine
    }

    return notifications;
  }

  /**
   * List notifications for a specific admin user with pagination.
   */
  async list(
    userId: string,
    params: { page: number; limit: number; unreadOnly?: boolean },
  ) {
    const { page, limit, unreadOnly } = params;
    const skip = (page - 1) * limit;

    const where: { userId: string; isRead?: boolean } = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [data, total] = await Promise.all([
      prisma.adminNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.adminNotification.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get the count of unread notifications for a specific admin user.
   */
  async getUnreadCount(userId: string) {
    const count = await prisma.adminNotification.count({
      where: { userId, isRead: false },
    });
    return count;
  }

  /**
   * Mark a single notification as read (verifying ownership).
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await prisma.adminNotification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      return null;
    }

    return prisma.adminNotification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * Mark all unread notifications as read for a specific admin user.
   */
  async markAllAsRead(userId: string) {
    const result = await prisma.adminNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return result;
  }

  /**
   * Delete a single notification (verifying ownership).
   */
  async delete(userId: string, notificationId: string) {
    const notification = await prisma.adminNotification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      return null;
    }

    return prisma.adminNotification.delete({
      where: { id: notificationId },
    });
  }
}

export const adminNotificationService = new AdminNotificationService();
