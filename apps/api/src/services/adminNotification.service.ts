import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { systemSettings, type AdminAlertEvent } from './systemSettings.service';

interface AdminAlert {
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export class AdminNotificationService {
  /**
   * Raise an admin alert for a platform event, honouring the admin notification settings
   * (Settings → Notifications):
   *  - the event's NOTIFY_* toggle decides whether anything is sent at all;
   *  - when ENABLE_EMAIL_NOTIFICATIONS is on and ADMIN_ALERT_EMAIL is set, the alert is
   *    also emailed to that address.
   * Returns whether the alert was sent. Callers treat this as fire-and-forget.
   */
  async notifyEvent(event: AdminAlertEvent, alert: AdminAlert): Promise<boolean> {
    const settings = await systemSettings.notifications();
    if (!settings.events[event]) return false;

    await this.create(alert);

    if (settings.alertEmail) {
      try {
        const { emailQueue } = await import('../queues');
        await emailQueue.add('custom', {
          type: 'custom',
          to: settings.alertEmail,
          subject: `[Mojeeb Admin] ${alert.title}`,
          body: alert.body,
        });
      } catch (err) {
        logger.warn({ err, event }, 'Failed to queue admin alert email');
      }
    }
    return true;
  }

  /**
   * A registration creates a user and an organization. The usual alert covers both; when
   * the "new user" alert is switched off but the "new organization" one is on, an
   * organization-only alert is sent instead.
   */
  async notifyRegistration(data: {
    firstName: string;
    lastName: string;
    email: string;
    organizationName: string;
  }): Promise<void> {
    const sent = await this.notifyEvent('NEW_USER_SIGNUP', {
      type: 'NEW_USER',
      title: 'New User Registration',
      body: `${data.firstName} ${data.lastName} (${data.email}) registered and created organization "${data.organizationName}".`,
    });
    if (!sent) {
      await this.notifyEvent('NEW_ORG_CREATED', {
        type: 'NEW_ORG',
        title: 'New Organization',
        body: `Organization "${data.organizationName}" was created by ${data.email}.`,
      });
    }
  }

  /** Alert admins that a payment failed (honours the NOTIFY_FAILED_PAYMENT setting). */
  async notifyFailedPayment(info: { gateway: string; orgId?: string; invoiceId?: string }) {
    const subject = info.orgId ? ` for organization ${info.orgId}` : '';
    const invoice = info.invoiceId ? ` (invoice ${info.invoiceId})` : '';
    await this.notifyEvent('FAILED_PAYMENT', {
      type: 'PAYMENT_FAILED',
      title: 'Payment Failed',
      body: `A ${info.gateway} payment failed${subject}${invoice}.`,
      metadata: { ...info },
    });
  }

  /**
   * Alert admins about an unhandled server error, at most once every 10 minutes so an
   * error storm cannot flood the notification list or the alert mailbox.
   */
  async notifySystemError(summary: { message: string; method?: string; path?: string }) {
    const { redis } = await import('../config/redis');
    const first = await redis.set('admin-alert:system-error:throttle', '1', 'EX', 600, 'NX');
    if (first !== 'OK') return;
    const where = summary.method && summary.path ? ` on ${summary.method} ${summary.path}` : '';
    await this.notifyEvent('SYSTEM_ERRORS', {
      type: 'SYSTEM_ERROR',
      title: 'System Error',
      body: `Unhandled server error${where}: ${summary.message.slice(0, 300)}. See Error Logs for details (further errors in the next 10 minutes are not announced).`,
    });
  }

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
            metadata: (metadata as any) ?? undefined,
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
  async list(userId: string, params: { page: number; limit: number; unreadOnly?: boolean }) {
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
