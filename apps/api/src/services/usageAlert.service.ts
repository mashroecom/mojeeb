import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { notificationService } from './notification.service';
import { emailService } from './email.service';
import { aiConversationTrackingService } from './aiConversationTracking.service';

/**
 * Alert thresholds for AI conversation usage
 */
const ALERT_THRESHOLD_WARNING = 80; // 80% usage
const ALERT_THRESHOLD_LIMIT = 100; // 100% usage (limit reached)

/**
 * Notification types for usage alerts
 */
const NOTIFICATION_TYPE_USAGE_WARNING = 'USAGE_WARNING';
const NOTIFICATION_TYPE_USAGE_LIMIT = 'USAGE_LIMIT';

export class UsageAlertService {
  /**
   * Check AI conversation usage and send alerts if thresholds are crossed.
   * Returns true if an alert was sent, false otherwise.
   */
  async checkAndSendAlerts(orgId: string): Promise<boolean> {
    try {
      const stats = await aiConversationTrackingService.getUsageStats(orgId);
      const percentage = stats.percentage;

      // Determine which alert should be sent based on current percentage
      if (percentage >= ALERT_THRESHOLD_LIMIT) {
        // 100% limit reached
        return await this.send100PercentAlert(orgId, stats.used, stats.limit);
      } else if (percentage >= ALERT_THRESHOLD_WARNING) {
        // 80% warning threshold
        return await this.send80PercentAlert(orgId, stats.used, stats.limit, percentage);
      }

      return false;
    } catch (err) {
      logger.error({ err, orgId }, 'Failed to check and send usage alerts');
      return false;
    }
  }

  /**
   * Send 80% usage warning alert.
   * Sends both in-app notification and email to organization members.
   * Only sends if no alert has been sent yet for this threshold.
   */
  async send80PercentAlert(
    orgId: string,
    used: number,
    limit: number,
    percentage: number,
  ): Promise<boolean> {
    try {
      // Check if we already sent this alert level
      const lastAlert = await this.getLastAlertLevel(orgId);
      if (lastAlert !== null && lastAlert >= ALERT_THRESHOLD_WARNING) {
        // Already sent warning or limit alert
        return false;
      }

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      });

      if (!org) {
        logger.warn({ orgId }, 'Organization not found for usage alert');
        return false;
      }

      const title = 'AI Conversations Usage Warning';
      const body = `Your organization "${org.name}" has used ${percentage}% (${used}/${limit}) of your monthly AI conversation limit. Consider upgrading your plan to avoid service interruption.`;

      // Send in-app notification to all org members
      await notificationService.createForOrgMembers({
        orgId,
        type: NOTIFICATION_TYPE_USAGE_WARNING,
        title,
        body,
        metadata: {
          used,
          limit,
          percentage,
          threshold: ALERT_THRESHOLD_WARNING,
        },
      });

      // Send email to members with usage warning enabled
      await this.sendUsageAlertEmails(orgId, title, body, 'warning');

      // Update last alert level
      await this.updateLastAlertLevel(orgId, ALERT_THRESHOLD_WARNING);

      logger.info({ orgId, percentage, used, limit }, '80% usage alert sent');
      return true;
    } catch (err) {
      logger.error({ err, orgId }, 'Failed to send 80% usage alert');
      return false;
    }
  }

  /**
   * Send 100% usage limit reached alert.
   * Sends both in-app notification and email to organization members.
   * Only sends if no limit alert has been sent yet.
   */
  async send100PercentAlert(orgId: string, used: number, limit: number): Promise<boolean> {
    try {
      // Check if we already sent this alert level
      const lastAlert = await this.getLastAlertLevel(orgId);
      if (lastAlert !== null && lastAlert >= ALERT_THRESHOLD_LIMIT) {
        // Already sent limit alert
        return false;
      }

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      });

      if (!org) {
        logger.warn({ orgId }, 'Organization not found for usage alert');
        return false;
      }

      const subscription = await prisma.subscription.findUnique({
        where: { orgId },
        select: {
          plan: true,
          spendingCapEnabled: true,
          spendingCapAmount: true,
        },
      });

      let body: string;
      if (subscription?.spendingCapEnabled && subscription.spendingCapAmount !== null) {
        body = `Your organization "${org.name}" has reached 100% (${used}/${limit}) of your monthly AI conversation limit. Your spending cap is enabled, so AI responses may be blocked. Please upgrade your plan or increase your spending cap to continue service.`;
      } else {
        const planConfig = await prisma.planConfig.findUnique({
          where: { plan: subscription?.plan || 'FREE' },
        });
        const overagePrice = planConfig?.overagePricePerConversation ?? 0;
        body = `Your organization "${org.name}" has reached 100% (${used}/${limit}) of your monthly AI conversation limit. Additional conversations will be charged at $${overagePrice.toFixed(2)} per conversation. Consider upgrading your plan to reduce costs.`;
      }

      const title = 'AI Conversations Limit Reached';

      // Send in-app notification to all org members
      await notificationService.createForOrgMembers({
        orgId,
        type: NOTIFICATION_TYPE_USAGE_LIMIT,
        title,
        body,
        metadata: {
          used,
          limit,
          percentage: 100,
          threshold: ALERT_THRESHOLD_LIMIT,
          spendingCapEnabled: subscription?.spendingCapEnabled ?? false,
        },
      });

      // Send email to members with usage warning enabled
      await this.sendUsageAlertEmails(orgId, title, body, 'danger');

      // Update last alert level
      await this.updateLastAlertLevel(orgId, ALERT_THRESHOLD_LIMIT);

      logger.info({ orgId, used, limit }, '100% usage alert sent');
      return true;
    } catch (err) {
      logger.error({ err, orgId }, 'Failed to send 100% usage alert');
      return false;
    }
  }

  /**
   * Send usage alert emails to organization members who have email notifications enabled.
   */
  private async sendUsageAlertEmails(
    orgId: string,
    title: string,
    body: string,
    severity: 'warning' | 'danger',
  ): Promise<void> {
    try {
      // Get all organization members with their email preferences
      const members = await prisma.orgMembership.findMany({
        where: { orgId },
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      });

      for (const member of members) {
        try {
          // Check if user has email notifications enabled for usage warnings
          const prefs = await prisma.notificationPreference.findUnique({
            where: {
              orgId_userId: {
                orgId,
                userId: member.userId,
              },
            },
            select: { emailUsageWarning: true },
          });

          // Default to true if no preference set
          const emailEnabled = prefs?.emailUsageWarning ?? true;

          if (emailEnabled && member.user.email) {
            await emailService.sendUsageAlertEmail(
              member.user.email,
              title,
              body,
              severity,
              'en', // Default to English for now
            );
          }
        } catch (err) {
          logger.error(
            { err, userId: member.userId, orgId },
            'Failed to send usage alert email to member',
          );
          // Continue sending to other members
        }
      }
    } catch (err) {
      logger.error({ err, orgId }, 'Failed to send usage alert emails');
    }
  }

  /**
   * Get the last alert level sent for an organization.
   * Returns null if no alert has been sent yet in the current billing period.
   */
  private async getLastAlertLevel(orgId: string): Promise<number | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
      select: { updatedAt: true },
    });

    if (!subscription) {
      return null;
    }

    // Check for recent notifications (within current billing period)
    const warningNotif = await prisma.notification.findFirst({
      where: {
        orgId,
        type: NOTIFICATION_TYPE_USAGE_WARNING,
        createdAt: { gte: subscription.updatedAt },
      },
      orderBy: { createdAt: 'desc' },
    });

    const limitNotif = await prisma.notification.findFirst({
      where: {
        orgId,
        type: NOTIFICATION_TYPE_USAGE_LIMIT,
        createdAt: { gte: subscription.updatedAt },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Return the highest alert level sent
    if (limitNotif) return ALERT_THRESHOLD_LIMIT;
    if (warningNotif) return ALERT_THRESHOLD_WARNING;
    return null;
  }

  /**
   * Update the last alert level for an organization.
   * This is tracked via notification creation timestamps.
   */
  private async updateLastAlertLevel(orgId: string, level: number): Promise<void> {
    // Alert level is tracked implicitly via notification creation
    // No explicit update needed as we check notification timestamps
    logger.debug({ orgId, level }, 'Alert level updated');
  }

  /**
   * Reset alerts for an organization at the start of a new billing period.
   * This allows alerts to be sent again in the new period.
   */
  async resetAlertsForNewBillingPeriod(orgId: string): Promise<void> {
    try {
      // Delete old usage alert notifications from previous billing periods
      await prisma.notification.deleteMany({
        where: {
          orgId,
          type: {
            in: [NOTIFICATION_TYPE_USAGE_WARNING, NOTIFICATION_TYPE_USAGE_LIMIT],
          },
        },
      });

      logger.info({ orgId }, 'Usage alerts reset for new billing period');
    } catch (err) {
      logger.error({ err, orgId }, 'Failed to reset usage alerts');
    }
  }

  /**
   * Check all active subscriptions and send alerts where needed.
   * Useful for periodic background jobs.
   * Returns the number of alerts sent.
   */
  async checkAllSubscriptionsAndSendAlerts(): Promise<number> {
    try {
      const subscriptions = await prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        select: { orgId: true },
      });

      let alertsSent = 0;
      for (const sub of subscriptions) {
        try {
          const sent = await this.checkAndSendAlerts(sub.orgId);
          if (sent) {
            alertsSent++;
          }
        } catch (err) {
          logger.error({ err, orgId: sub.orgId }, 'Failed to check subscription for alerts');
        }
      }

      logger.info(
        { alertsSent, total: subscriptions.length },
        'Batch usage alert check completed',
      );
      return alertsSent;
    } catch (err) {
      logger.error({ err }, 'Failed to check all subscriptions for alerts');
      return 0;
    }
  }
}

export const usageAlertService = new UsageAlertService();
