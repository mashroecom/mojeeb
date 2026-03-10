import { prisma } from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';

/**
 * Type definition for web push subscription
 */
interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Type definition for push notification payload
 */
interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  tag?: string;
  requireInteraction?: boolean;
}

export class PushNotificationService {
  /**
   * Subscribe a user to push notifications.
   * Stores the push subscription details for later use.
   */
  async subscribe(data: {
    userId: string;
    orgId: string;
    subscription: PushSubscription;
    deviceInfo?: {
      userAgent?: string;
      platform?: string;
    };
  }) {
    // TODO: Store subscription in database once PushSubscription model is added
    // For now, we'll validate the input and return a success response
    if (!data.subscription.endpoint || !data.subscription.keys) {
      throw new BadRequestError('Invalid subscription format');
    }

    return {
      success: true,
      message: 'Push subscription registered successfully',
    };
  }

  /**
   * Unsubscribe a user from push notifications.
   * Removes the push subscription from storage.
   */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    // TODO: Remove subscription from database once PushSubscription model is added
    if (!endpoint) {
      throw new BadRequestError('Endpoint is required');
    }
  }

  /**
   * Get all active push subscriptions for a user within an organization.
   */
  async getUserSubscriptions(userId: string, orgId: string) {
    // TODO: Fetch from database once PushSubscription model is added
    return [];
  }

  /**
   * Send a push notification to a specific user.
   * Sends to all active subscriptions for that user.
   */
  async sendToUser(
    userId: string,
    orgId: string,
    payload: PushNotificationPayload,
  ): Promise<void> {
    // TODO: Implement web push sending using web-push library
    // 1. Fetch all active subscriptions for the user
    // 2. Send notification to each subscription
    // 3. Remove failed/expired subscriptions
    const subscriptions = await this.getUserSubscriptions(userId, orgId);

    if (subscriptions.length === 0) {
      // User has no active push subscriptions
      return;
    }

    // For now, this is a placeholder
    // Will be implemented with web-push library in future subtasks
  }

  /**
   * Send a push notification to all members of an organization.
   * Useful for org-wide events (e.g., new urgent conversation, system alerts).
   */
  async sendToOrgMembers(
    orgId: string,
    payload: PushNotificationPayload,
  ): Promise<void> {
    // Fetch all members of the organization
    const members = await prisma.orgMembership.findMany({
      where: { orgId },
      select: { userId: true },
    });

    if (members.length === 0) return;

    // Send notification to each member
    await Promise.allSettled(
      members.map((member) => this.sendToUser(member.userId, orgId, payload)),
    );
  }

  /**
   * Send push notification for handoff requests.
   * Notifies available agents when a conversation is handed off.
   */
  async notifyHandoff(data: {
    orgId: string;
    conversationId: string;
    fromAgentId?: string;
    toAgentId?: string;
  }): Promise<void> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
      select: {
        id: true,
        customerName: true,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const payload: PushNotificationPayload = {
      title: 'New Handoff Request',
      body: `Conversation with ${conversation.customerName || 'Customer'} needs attention`,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge.png',
      data: {
        type: 'handoff',
        conversationId: data.conversationId,
        url: `/admin/conversations/${data.conversationId}`,
      },
      tag: `handoff-${data.conversationId}`,
      requireInteraction: true,
    };

    // If specific agent is targeted, notify them
    // Otherwise, notify all org members
    if (data.toAgentId) {
      await this.sendToUser(data.toAgentId, data.orgId, payload);
    } else {
      await this.sendToOrgMembers(data.orgId, payload);
    }
  }

  /**
   * Send push notification for escalations.
   * Notifies managers/admins when a conversation is escalated.
   */
  async notifyEscalation(data: {
    orgId: string;
    conversationId: string;
    priority: 'high' | 'urgent';
  }): Promise<void> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
      select: {
        id: true,
        customerName: true,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const payload: PushNotificationPayload = {
      title: `${data.priority === 'urgent' ? '🚨 Urgent' : '⚠️ High Priority'} Escalation`,
      body: `Conversation with ${conversation.customerName || 'Customer'} requires immediate attention`,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge.png',
      data: {
        type: 'escalation',
        conversationId: data.conversationId,
        priority: data.priority,
        url: `/admin/conversations/${data.conversationId}`,
      },
      tag: `escalation-${data.conversationId}`,
      requireInteraction: true,
    };

    // Notify all org members for escalations
    await this.sendToOrgMembers(data.orgId, payload);
  }

  /**
   * Send push notification for CSAT alerts.
   * Notifies when a low CSAT rating is received.
   */
  async notifyCSATAlert(data: {
    orgId: string;
    conversationId: string;
    rating: number;
    comment?: string;
  }): Promise<void> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
      select: {
        id: true,
        customerName: true,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const payload: PushNotificationPayload = {
      title: '⭐ Low CSAT Alert',
      body: `${conversation.customerName || 'A customer'} rated ${data.rating}/5${data.comment ? ': ' + data.comment.substring(0, 50) : ''}`,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge.png',
      data: {
        type: 'csat_alert',
        conversationId: data.conversationId,
        rating: data.rating,
        url: `/admin/conversations/${data.conversationId}`,
      },
      tag: `csat-${data.conversationId}`,
      requireInteraction: false,
    };

    // Notify all org members for CSAT alerts
    await this.sendToOrgMembers(data.orgId, payload);
  }

  /**
   * Send push notification for new messages.
   * Notifies assigned agents when they receive a new message.
   */
  async notifyNewMessage(data: {
    orgId: string;
    conversationId: string;
    assignedAgentId?: string;
  }): Promise<void> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
      select: {
        id: true,
        customerName: true,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const payload: PushNotificationPayload = {
      title: 'New Message',
      body: `New message from ${conversation.customerName || 'Customer'}`,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge.png',
      data: {
        type: 'new_message',
        conversationId: data.conversationId,
        url: `/admin/conversations/${data.conversationId}`,
      },
      tag: `message-${data.conversationId}`,
      requireInteraction: false,
    };

    // If conversation is assigned, notify the assigned agent
    // Otherwise, notify all org members
    if (data.assignedAgentId) {
      await this.sendToUser(data.assignedAgentId, data.orgId, payload);
    } else {
      await this.sendToOrgMembers(data.orgId, payload);
    }
  }

  /**
   * Remove expired or invalid subscriptions.
   * Should be called periodically to clean up the database.
   */
  async cleanupExpiredSubscriptions(): Promise<number> {
    // TODO: Implement cleanup logic once PushSubscription model is added
    // 1. Find subscriptions that have failed multiple times
    // 2. Remove subscriptions older than X days with no successful sends
    return 0;
  }
}

export const pushNotificationService = new PushNotificationService();
