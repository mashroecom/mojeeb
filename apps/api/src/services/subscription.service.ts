import crypto from 'crypto';
import { prisma } from '../config/database';
import { config } from '../config';
import { logger } from '../config/logger';
import { cache } from '../config/cache';
import { configService } from './config.service';
import { NotFoundError, BadRequestError, UsageLimitError } from '../utils/errors';
import { SubscriptionPlan } from '@mojeeb/shared-types';
import { planConfigService } from './planConfig.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KashierOrderResponse {
  response: {
    orderId: string;
    checkoutUrl: string;
  };
}

export interface KashierWebhookPayload {
  event: string;
  data: {
    orderId: string;
    merchantOrderId: string;
    transactionId: string;
    amount: number;
    currency: string;
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    customerReference: string;
    paymentMethod: string;
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Convert Infinity to a large integer safe for Prisma/PostgreSQL.
 */
function safeLimit(value: number): number {
  return Number.isFinite(value) ? value : 999999;
}

/**
 * Get Kashier configuration dynamically from configService.
 * Falls back to static config if configService fails.
 */
async function getKashierConfig(): Promise<{
  merchantId: string;
  apiKey: string;
  webhookSecret: string;
}> {
  let merchantId: string;
  let apiKey: string;
  let webhookSecret: string;

  try {
    merchantId = await configService.get('KASHIER_MERCHANT_ID');
  } catch {
    merchantId = '';
  }
  if (!merchantId) {
    merchantId = config.kashier.merchantId;
  }

  try {
    apiKey = await configService.get('KASHIER_API_KEY');
  } catch {
    apiKey = '';
  }
  if (!apiKey) {
    apiKey = config.kashier.apiKey;
  }

  try {
    webhookSecret = await configService.get('KASHIER_WEBHOOK_SECRET');
  } catch {
    webhookSecret = '';
  }
  if (!webhookSecret) {
    webhookSecret = config.kashier.webhookSecret;
  }

  return { merchantId, apiKey, webhookSecret };
}

export class SubscriptionService {
  /**
   * Get subscription by organization ID (cached for 5 minutes).
   */
  async getByOrgId(orgId: string) {
    return cache.getOrSet(`subscription:${orgId}`, 300, async () => {
      const subscription = await prisma.subscription.findUnique({
        where: { orgId },
      });
      if (!subscription) throw new NotFoundError('Subscription not found');
      return subscription;
    });
  }

  /**
   * Create a Kashier checkout session for upgrading to a paid plan.
   * In development without Kashier credentials, upgrades directly (demo mode).
   */
  async createCheckout(orgId: string, plan: string) {
    // Validate the target plan
    if (plan !== 'STARTER' && plan !== 'PROFESSIONAL') {
      throw new BadRequestError('Invalid plan. Must be STARTER or PROFESSIONAL.');
    }

    const subscription = await this.getByOrgId(orgId);

    // Prevent upgrading to the same plan
    if (subscription.plan === plan) {
      throw new BadRequestError('You are already on this plan.');
    }

    const amount = await planConfigService.getPrice(plan);
    if (!amount) {
      throw new BadRequestError('Plan price not configured.');
    }

    // Get dynamic Kashier config (falls back to static config)
    const kashier = await getKashierConfig();

    // If Kashier credentials are not configured, payment is not available
    if (!kashier.apiKey || !kashier.merchantId) {
      throw new BadRequestError('Payment gateway is not configured. Please set KASHIER_API_KEY and KASHIER_MERCHANT_ID in your environment.');
    }

    const merchantOrderId = `mojeeb_${orgId}_${Date.now()}`;
    const currency = 'USD';

    // Generate Kashier payment hash
    // Path format: /?payment=mid.orderId.amount.currency
    // Hash = HMAC-SHA256(path, apiKey)
    const hashPath = `/?payment=${kashier.merchantId}.${merchantOrderId}.${amount}.${currency}`;
    const hash = crypto
      .createHmac('sha256', kashier.apiKey)
      .update(hashPath)
      .digest('hex');

    const redirectUrl = `${config.frontendUrl}/billing?status=success`;
    const failureRedirectUrl = `${config.frontendUrl}/billing?status=failed`;

    // Build Kashier hosted checkout URL
    const checkoutParams = new URLSearchParams({
      merchantId: kashier.merchantId,
      orderId: merchantOrderId,
      amount: String(amount),
      currency,
      hash,
      mode: config.nodeEnv === 'production' ? 'live' : 'test',
      merchantRedirect: redirectUrl,
      failureRedirect: failureRedirectUrl,
      display: 'en',
      brandColor: '#6366F1',
    });

    const checkoutUrl = `https://checkout.kashier.io/?${checkoutParams.toString()}`;

    // Store the pending invoice
    await prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        amount,
        currency,
        status: 'PENDING',
        kashierOrderId: merchantOrderId,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
      },
    });

    logger.info({ orgId, plan, merchantOrderId }, 'Kashier checkout session created');

    return {
      checkoutUrl,
      orderId: merchantOrderId,
    };
  }

  /**
   * Confirm a payment from Kashier redirect parameters.
   * This is used when the webhook can't reach the server (e.g., localhost).
   */
  async confirmPayment(orgId: string, params: {
    merchantOrderId: string;
    paymentStatus: string;
    transactionId?: string;
    amount: string;
    currency: string;
    signature?: string;
  }) {
    const { merchantOrderId, paymentStatus, transactionId, amount } = params;

    logger.info({ orgId, merchantOrderId, paymentStatus, amount: params.amount }, 'Confirming payment from redirect');

    if (paymentStatus !== 'SUCCESS') {
      throw new BadRequestError('Payment was not successful.');
    }

    // Find the invoice by Kashier order ID
    const invoice = await prisma.invoice.findUnique({
      where: { kashierOrderId: merchantOrderId },
      include: { subscription: true },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found for this payment.');
    }

    // Ensure invoice belongs to this organization
    if (invoice.subscription.orgId !== orgId) {
      throw new BadRequestError('Invoice does not belong to this organization.');
    }

    // Already processed
    if (invoice.status === 'PAID') {
      return this.getByOrgId(orgId);
    }

    // Verify amount matches (use parseFloat + String to handle Prisma Decimal safely)
    const paidAmountNum = parseFloat(amount);
    const invoiceAmountNum = parseFloat(String(invoice.amount));
    logger.info({ paidAmountNum, invoiceAmountNum, rawAmount: amount, rawInvoiceAmount: String(invoice.amount) }, 'Comparing payment amounts');
    if (paidAmountNum !== invoiceAmountNum) {
      throw new BadRequestError(`Payment amount (${paidAmountNum}) does not match invoice amount (${invoiceAmountNum}).`);
    }

    // Determine the new plan from the payment amount
    const paidAmount = Number(amount);
    const newPlan = await planConfigService.getPlanByPrice(paidAmount);
    if (!newPlan) {
      throw new BadRequestError('Unknown payment amount — cannot determine plan.');
    }

    const limits = await planConfigService.getLimits(newPlan);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Update subscription with new plan
    await prisma.subscription.update({
      where: { id: invoice.subscriptionId },
      data: {
        plan: newPlan,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        messagesUsed: 0,
        messagesLimit: safeLimit(limits.messagesPerMonth),
        agentsLimit: safeLimit(limits.maxAgents),
        integrationsLimit: safeLimit(limits.maxChannels),
      },
    });

    // Mark the invoice as paid
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'PAID',
        kashierPaymentId: transactionId ?? null,
        paidAt: now,
      },
    });

    await cache.del(`subscription:${orgId}`);

    logger.info(
      { orgId, newPlan, merchantOrderId },
      'Payment confirmed via redirect, subscription upgraded',
    );

    return this.getByOrgId(orgId);
  }

  /**
   * Verify a Kashier webhook signature.
   */
  async verifyWebhookSignature(rawBody: string, signature: string): Promise<boolean> {
    const kashier = await getKashierConfig();
    const expectedSignature = crypto
      .createHmac('sha256', kashier.webhookSecret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  }

  /**
   * Handle a Kashier payment webhook event.
   */
  async handlePaymentWebhook(payload: KashierWebhookPayload) {
    const { data } = payload;

    logger.info(
      { orderId: data.merchantOrderId, status: data.status, event: payload.event },
      'Processing Kashier webhook',
    );

    // Find the invoice by Kashier order ID
    const invoice = await prisma.invoice.findUnique({
      where: { kashierOrderId: data.merchantOrderId },
      include: { subscription: true },
    });

    if (!invoice) {
      logger.warn({ orderId: data.merchantOrderId }, 'Invoice not found for Kashier webhook');
      return;
    }

    if (data.status === 'SUCCESS') {
      // Determine the new plan from the payment amount
      const amount = Number(data.amount);
      const newPlan = await planConfigService.getPlanByPrice(amount);
      if (!newPlan) {
        logger.error({ amount }, 'Unknown payment amount - cannot determine plan');
        return;
      }

      const limits = await planConfigService.getLimits(newPlan);
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      // Update subscription with new plan and reset usage counters
      await prisma.subscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          plan: newPlan,
          status: 'ACTIVE',
          kashierCustomerId: data.customerReference,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          messagesUsed: 0,
          messagesLimit: safeLimit(limits.messagesPerMonth),
          agentsLimit: safeLimit(limits.maxAgents),
          integrationsLimit: safeLimit(limits.maxChannels),
        },
      });

      // Mark the invoice as paid
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          kashierPaymentId: data.transactionId,
          paidAt: now,
        },
      });

      await cache.del(`subscription:${invoice.subscription.orgId}`);

      logger.info(
        { orgId: invoice.subscription.orgId, newPlan },
        'Subscription upgraded successfully',
      );
    } else if (data.status === 'FAILED') {
      // Mark the invoice as failed
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'FAILED' },
      });

      logger.warn(
        { orgId: invoice.subscription.orgId, orderId: data.merchantOrderId },
        'Payment failed',
      );
    }
    // PENDING status: do nothing, wait for final status
  }

  /**
   * Cancel subscription. If immediate=true, downgrade to FREE now.
   * If immediate=false, mark for cancellation at period end.
   */
  async cancelSubscription(orgId: string, immediate = false) {
    const subscription = await this.getByOrgId(orgId);

    if (subscription.plan === 'FREE') {
      throw new BadRequestError('You are already on the Free plan.');
    }

    if (!immediate) {
      // Schedule cancellation at end of billing period
      const updated = await prisma.subscription.update({
        where: { orgId },
        data: { cancelAtPeriodEnd: true },
      });

      await cache.del(`subscription:${orgId}`);

      logger.info({ orgId }, 'Subscription marked for cancellation at period end');
      return updated;
    }

    // Immediate cancellation
    const freeLimits = await planConfigService.getLimits(SubscriptionPlan.FREE);

    const updated = await prisma.subscription.update({
      where: { orgId },
      data: {
        plan: 'FREE',
        status: 'CANCELED',
        cancelAtPeriodEnd: false,
        messagesLimit: safeLimit(freeLimits.messagesPerMonth),
        agentsLimit: safeLimit(freeLimits.maxAgents),
        integrationsLimit: safeLimit(freeLimits.maxChannels),
      },
    });

    // Create a $0 invoice recording the cancellation
    await prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        amount: 0,
        currency: 'USD',
        status: 'PAID',
        paidAt: new Date(),
        dueDate: new Date(),
      },
    });

    await cache.del(`subscription:${orgId}`);

    logger.info({ orgId }, 'Subscription canceled immediately, downgraded to FREE');

    return updated;
  }

  /**
   * Check if the organization is within its usage limits.
   * Returns true if usage is allowed, false if at/over limit.
   */
  async checkUsage(
    orgId: string,
    type: 'messages' | 'agents',
  ): Promise<boolean> {
    const subscription = await this.getByOrgId(orgId);

    switch (type) {
      case 'messages':
        return subscription.messagesUsed < subscription.messagesLimit;
      case 'agents':
        return subscription.agentsUsed < subscription.agentsLimit;
      default:
        return false;
    }
  }

  /**
   * Increment a usage counter. Throws UsageLimitError if the limit is reached.
   */
  async incrementUsage(
    orgId: string,
    type: 'messages' | 'agents',
  ) {
    const allowed = await this.checkUsage(orgId, type);
    if (!allowed) {
      throw new UsageLimitError(
        `${type.charAt(0).toUpperCase() + type.slice(1)} limit reached. Please upgrade your plan.`,
      );
    }

    const fieldMap = {
      messages: 'messagesUsed',
      agents: 'agentsUsed',
    } as const;

    const field = fieldMap[type];

    await prisma.subscription.update({
      where: { orgId },
      data: { [field]: { increment: 1 } },
    });

    await cache.del(`subscription:${orgId}`);
  }

  /**
   * Decrement a usage counter (e.g. when deleting an agent).
   */
  async decrementUsage(
    orgId: string,
    type: 'agents',
  ) {
    const fieldMap = {
      agents: 'agentsUsed',
    } as const;

    const field = fieldMap[type];

    await prisma.subscription.update({
      where: { orgId },
      data: { [field]: { decrement: 1 } },
    });

    await cache.del(`subscription:${orgId}`);
  }

  /**
   * Sync agentsUsed with actual agent count in the database.
   */
  async syncAgentCount(orgId: string) {
    const count = await prisma.agent.count({ where: { orgId } });
    await prisma.subscription.update({
      where: { orgId },
      data: { agentsUsed: count },
    });
  }

  /**
   * Get paginated invoices for an organization.
   */
  async getInvoices(orgId: string, { page = 1, limit = 20 }: { page?: number; limit?: number } = {}) {
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
    });

    if (!subscription) throw new NotFoundError('Subscription not found');

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { subscriptionId: subscription.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({
        where: { subscriptionId: subscription.id },
      }),
    ]);

    return {
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single invoice by ID for an organization.
   */
  async getInvoiceById(orgId: string, invoiceId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
    });

    if (!subscription) throw new NotFoundError('Subscription not found');

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        subscriptionId: subscription.id,
      },
    });

    if (!invoice) throw new NotFoundError('Invoice not found');

    return invoice;
  }
}

export const subscriptionService = new SubscriptionService();
