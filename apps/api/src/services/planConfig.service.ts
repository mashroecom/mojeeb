import { prisma } from '../config/database';
import { cache } from '../config/cache';
import { logger } from '../config/logger';
import { PLAN_LIMITS, SubscriptionPlan } from '@mojeeb/shared-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanLimits {
  messagesPerMonth: number;
  maxAgents: number;
  maxChannels: number;
  maxKnowledgeBases: number;
  maxTeamMembers: number;
  apiAccess: boolean;
}

// ---------------------------------------------------------------------------
// Fallback prices (USD)
// ---------------------------------------------------------------------------

const FALLBACK_PRICES: Record<string, number> = {
  STARTER: 25,
  PROFESSIONAL: 99,
};

// ---------------------------------------------------------------------------
// Cache keys & TTL
// ---------------------------------------------------------------------------

const CACHE_PREFIX = 'planConfig';
const CACHE_TTL = 300; // 5 minutes

function cacheKey(plan: string): string {
  return `${CACHE_PREFIX}:${plan}`;
}

const ALL_PLANS_KEY = `${CACHE_PREFIX}:all`;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PlanConfigService {
  /**
   * Get plan limits for a given subscription plan.
   * Cached for 5 minutes. Falls back to PLAN_LIMITS constant if DB record not found.
   */
  async getLimits(plan: SubscriptionPlan): Promise<PlanLimits> {
    return cache.getOrSet(cacheKey(plan), CACHE_TTL, async () => {
      try {
        const row = await prisma.planConfig.findUnique({ where: { plan } });

        if (row) {
          return {
            messagesPerMonth: row.messagesPerMonth,
            maxAgents: row.maxAgents,
            maxChannels: row.maxChannels,
            maxKnowledgeBases: row.maxKnowledgeBases,
            maxTeamMembers: row.maxTeamMembers,
            apiAccess: row.apiAccess,
          };
        }
      } catch (err) {
        logger.warn({ err, plan }, 'Failed to load plan config from DB, using fallback');
      }

      return { ...PLAN_LIMITS[plan] };
    });
  }

  /**
   * Get the monthly price for a plan.
   * Cached for 5 minutes. Falls back to hardcoded FALLBACK_PRICES.
   */
  async getPrice(plan: string): Promise<number> {
    return cache.getOrSet(`${CACHE_PREFIX}:price:${plan}`, CACHE_TTL, async () => {
      try {
        const row = await prisma.planConfig.findUnique({
          where: { plan: plan as SubscriptionPlan },
          select: { monthlyPrice: true },
        });

        if (row) return row.monthlyPrice;
      } catch (err) {
        logger.warn({ err, plan }, 'Failed to load plan price from DB, using fallback');
      }

      return FALLBACK_PRICES[plan] ?? 0;
    });
  }

  /**
   * Given a payment amount, return the matching SubscriptionPlan.
   * Loads all plan configs from cache, finds the plan whose monthlyPrice matches.
   * Falls back to hardcoded price comparison.
   */
  async getPlanByPrice(amount: number): Promise<SubscriptionPlan | null> {
    try {
      const plans = await cache.getOrSet(ALL_PLANS_KEY, CACHE_TTL, async () => {
        return prisma.planConfig.findMany({
          select: { plan: true, monthlyPrice: true },
        });
      });

      const match = plans.find((p) => p.monthlyPrice === amount);
      if (match) return match.plan as SubscriptionPlan;
    } catch (err) {
      logger.warn({ err, amount }, 'Failed to match plan by price from DB, using fallback');
    }

    // Fallback to hardcoded prices
    for (const [plan, price] of Object.entries(FALLBACK_PRICES)) {
      if (price === amount) return plan as SubscriptionPlan;
    }

    return null;
  }

  /**
   * Invalidate cached plan config.
   * If a plan is specified, only that plan's cache is cleared.
   * Otherwise all plan config caches are cleared.
   */
  async invalidateCache(plan?: string): Promise<void> {
    if (plan) {
      await cache.del(cacheKey(plan));
      await cache.del(`${CACHE_PREFIX}:price:${plan}`);
    } else {
      await cache.delPattern(`${CACHE_PREFIX}:*`);
    }
    await cache.del(ALL_PLANS_KEY);
  }
}

export const planConfigService = new PlanConfigService();
