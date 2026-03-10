import { prisma } from '../config/database';
import { cache } from '../config/cache';
import { logger } from '../config/logger';
import { NotFoundError, UsageLimitError } from '../utils/errors';
import { planConfigService } from './planConfig.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsageStats {
  used: number;
  limit: number;
  percentage: number;
  remaining: number;
  isOverLimit: boolean;
}

// ---------------------------------------------------------------------------
// Cache keys & TTL
// ---------------------------------------------------------------------------

const CACHE_PREFIX = 'aiConversation';
const CACHE_TTL = 60; // 1 minute

function cacheKey(orgId: string): string {
  return `${CACHE_PREFIX}:${orgId}`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AiConversationTrackingService {
  /**
   * Increment AI conversation count for an organization.
   * Increments aiConversationsUsed by 1 and invalidates cache.
   * Throws UsageLimitError if spending cap is enabled and limit exceeded.
   */
  async incrementAiConversation(orgId: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
      select: {
        id: true,
        aiConversationsUsed: true,
        aiConversationsLimit: true,
        spendingCapEnabled: true,
        spendingCapAmount: true,
        overageChargesAccrued: true,
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    // Check if limit reached and spending cap enabled
    if (subscription.spendingCapEnabled && subscription.aiConversationsUsed >= subscription.aiConversationsLimit) {
      const planConfig = await prisma.planConfig.findUnique({
        where: { plan: subscription.plan },
        select: { overagePricePerConversation: true },
      });

      const overagePrice = planConfig?.overagePricePerConversation ?? 0;
      const newOverageCharge = Number(subscription.overageChargesAccrued) + overagePrice;

      // Check if spending cap would be exceeded
      if (
        subscription.spendingCapAmount !== null &&
        newOverageCharge > Number(subscription.spendingCapAmount)
      ) {
        throw new UsageLimitError(
          'AI conversation limit reached and spending cap exceeded. Please upgrade your plan or increase spending cap.',
          'AI_CONVERSATION_LIMIT',
        );
      }
    }

    // Increment the counter
    await prisma.subscription.update({
      where: { orgId },
      data: {
        aiConversationsUsed: {
          increment: 1,
        },
      },
    });

    // Invalidate cache
    await cache.del(cacheKey(orgId));

    logger.info({ orgId, used: subscription.aiConversationsUsed + 1 }, 'AI conversation incremented');
  }

  /**
   * Check if organization has reached AI conversation limit.
   * Returns true if limit reached, false otherwise.
   * Respects spending cap settings.
   */
  async checkLimit(orgId: string): Promise<boolean> {
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
      select: {
        aiConversationsUsed: true,
        aiConversationsLimit: true,
        spendingCapEnabled: true,
        spendingCapAmount: true,
        overageChargesAccrued: true,
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    // If under limit, always allow
    if (subscription.aiConversationsUsed < subscription.aiConversationsLimit) {
      return false;
    }

    // If over limit but no spending cap enabled, allow (will accrue overages)
    if (!subscription.spendingCapEnabled) {
      return false;
    }

    // If spending cap enabled, check if cap exceeded
    if (subscription.spendingCapAmount === null) {
      return false;
    }

    const planConfig = await prisma.planConfig.findUnique({
      where: { plan: subscription.plan },
      select: { overagePricePerConversation: true },
    });

    const overagePrice = planConfig?.overagePricePerConversation ?? 0;
    const newOverageCharge = Number(subscription.overageChargesAccrued) + overagePrice;

    return newOverageCharge > Number(subscription.spendingCapAmount);
  }

  /**
   * Get AI conversation usage statistics for an organization.
   * Cached for 1 minute.
   */
  async getUsageStats(orgId: string): Promise<UsageStats> {
    return cache.getOrSet(cacheKey(orgId), CACHE_TTL, async () => {
      const subscription = await prisma.subscription.findUnique({
        where: { orgId },
        select: {
          aiConversationsUsed: true,
          aiConversationsLimit: true,
        },
      });

      if (!subscription) {
        throw new NotFoundError('Subscription not found');
      }

      const used = subscription.aiConversationsUsed;
      const limit = subscription.aiConversationsLimit;
      const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;
      const remaining = Math.max(0, limit - used);
      const isOverLimit = used >= limit;

      return {
        used,
        limit,
        percentage,
        remaining,
        isOverLimit,
      };
    });
  }

  /**
   * Get usage percentage (0-100) for an organization.
   * Cached for 1 minute.
   */
  async getUsagePercentage(orgId: string): Promise<number> {
    const stats = await this.getUsageStats(orgId);
    return stats.percentage;
  }

  /**
   * Reset monthly AI conversation usage for an organization.
   * Called at the start of each billing period.
   */
  async resetMonthlyUsage(orgId: string): Promise<void> {
    await prisma.subscription.update({
      where: { orgId },
      data: {
        aiConversationsUsed: 0,
        overageChargesAccrued: 0,
      },
    });

    // Invalidate cache
    await cache.del(cacheKey(orgId));

    logger.info({ orgId }, 'AI conversation usage reset for new billing period');
  }

  /**
   * Reset monthly usage for all active subscriptions.
   * Useful for batch processing at billing period start.
   */
  async resetAllMonthlyUsage(): Promise<number> {
    const subscriptions = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      select: { orgId: true },
    });

    let resetCount = 0;
    for (const sub of subscriptions) {
      try {
        await this.resetMonthlyUsage(sub.orgId);
        resetCount++;
      } catch (err) {
        logger.error({ err, orgId: sub.orgId }, 'Failed to reset AI conversation usage');
      }
    }

    logger.info({ resetCount, total: subscriptions.length }, 'Batch reset AI conversation usage');
    return resetCount;
  }

  /**
   * Invalidate cache for an organization's AI conversation usage.
   */
  async invalidateCache(orgId: string): Promise<void> {
    await cache.del(cacheKey(orgId));
  }
}

export const aiConversationTrackingService = new AiConversationTrackingService();
