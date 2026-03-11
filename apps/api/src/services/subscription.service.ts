import Stripe from 'stripe';
import { prisma } from '../config/database';
import { config } from '../config';
import { logger } from '../config/logger';
import { cache } from '../config/cache';
import { configService } from './config.service';
import { NotFoundError, BadRequestError, UsageLimitError } from '../utils/errors';
import { SubscriptionPlan, PaymentGateway } from '@mojeeb/shared-types';
import { planConfigService } from './planConfig.service';
import {
  PaymentProvider,
  KashierProvider,
  StripeProvider,
  PayPalProvider,
} from './payments';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Re-export webhook payload types from providers for public API
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

export interface PayPalWebhookPayload {
  event_type: string;
  resource: {
    id: string;
    status: string;
    purchase_units?: Array<{
      reference_id: string;
      amount: {
        value: string;
        currency_code: string;
      };
      payments?: {
        captures?: Array<{
          id: string;
          status: string;
        }>;
      };
    }>;
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
 * Provider instances (singleton pattern).
 */
const providerInstances: Partial<Record<PaymentGateway, PaymentProvider>> = {};

/**
 * Get or create a payment provider instance for the specified gateway.
 * Uses singleton pattern to ensure only one instance per provider type.
 *
 * @param gateway - The payment gateway type
 * @returns Payment provider instance
 */
function getPaymentProvider(gateway: PaymentGateway): PaymentProvider {
  if (!providerInstances[gateway]) {
    switch (gateway) {
      case PaymentGateway.KASHIER:
        providerInstances[gateway] = new KashierProvider();
        break;
      case PaymentGateway.STRIPE:
        providerInstances[gateway] = new StripeProvider();
        break;
      case PaymentGateway.PAYPAL:
        providerInstances[gateway] = new PayPalProvider();
        break;
      default:
        throw new BadRequestError(`Unsupported payment gateway: ${gateway}`);
    }
  }
  return providerInstances[gateway]!;
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
  async createCheckout(
    orgId: string,
    plan: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly',
  ) {
    // Validate the target plan
    if (plan !== 'STARTER' && plan !== 'PROFESSIONAL') {
      throw new BadRequestError('Invalid plan. Must be STARTER or PROFESSIONAL.');
    }

    const subscription = await this.getByOrgId(orgId);

    // Prevent upgrading to the same plan
    if (subscription.plan === plan) {
      throw new BadRequestError('You are already on this plan.');
    }

    const amount = await planConfigService.getPrice(plan, billingCycle);
    if (!amount) {
      throw new BadRequestError('Plan price not configured.');
    }

    const currency = 'USD';
    const redirectUrl = `${config.frontendUrl}/billing?status=success`;
    const failureRedirectUrl = `${config.frontendUrl}/billing?status=failed`;

    // Delegate to KashierProvider
    const provider = getPaymentProvider(PaymentGateway.KASHIER);
    return await provider.createCheckout({
      orgId,
      plan,
      billingCycle,
      amount,
      currency,
      redirectUrl,
      failureRedirectUrl,
    });
  }

  /**
   * Confirm a payment from Kashier redirect parameters.
   * This is used when the webhook can't reach the server (e.g., localhost).
   */
  async confirmPayment(
    orgId: string,
    params: {
      merchantOrderId: string;
      paymentStatus: string;
      transactionId?: string;
      amount: string;
      currency: string;
      signature?: string;
    },
  ) {
    const { merchantOrderId, paymentStatus, transactionId, amount, currency } = params;

    // Delegate to KashierProvider
    const provider = getPaymentProvider(PaymentGateway.KASHIER);
    await provider.confirmPayment({
      orgId,
      paymentId: merchantOrderId,
      additionalParams: {
        paymentStatus,
        transactionId,
        amount,
        currency,
      },
    });

    return this.getByOrgId(orgId);
  }

  /**
   * Create a Stripe checkout session for upgrading to a paid plan.
   */
  async createStripeCheckout(orgId: string, plan: string, billingCycle: 'monthly' | 'yearly' = 'monthly') {
    // Validate the target plan
    if (plan !== 'STARTER' && plan !== 'PROFESSIONAL') {
      throw new BadRequestError('Invalid plan. Must be STARTER or PROFESSIONAL.');
    }

    const subscription = await this.getByOrgId(orgId);

    // Prevent upgrading to the same plan
    if (subscription.plan === plan) {
      throw new BadRequestError('You are already on this plan.');
    }

    const amount = await planConfigService.getPrice(plan, billingCycle);
    if (!amount) {
      throw new BadRequestError('Plan price not configured.');
    }

    const currency = 'USD';
    const redirectUrl = `${config.frontendUrl}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`;
    const failureRedirectUrl = `${config.frontendUrl}/billing?status=canceled`;

    // Delegate to StripeProvider
    const provider = getPaymentProvider(PaymentGateway.STRIPE);
    const result = await provider.createCheckout({
      orgId,
      plan,
      billingCycle,
      amount,
      currency,
      redirectUrl,
      failureRedirectUrl,
    });

    return {
      checkoutUrl: result.checkoutUrl,
      sessionId: result.orderId,
    };
  }

  /**
   * Confirm a Stripe payment from checkout session.
   */
  async confirmStripePayment(orgId: string, sessionId: string) {
    // Delegate to StripeProvider
    const provider = getPaymentProvider(PaymentGateway.STRIPE);
    await provider.confirmPayment({
      orgId,
      paymentId: sessionId,
    });

    return this.getByOrgId(orgId);
  }

  /**
   * Create a PayPal checkout session for upgrading to a paid plan.
   */
  async createPayPalCheckout(orgId: string, plan: string, billingCycle: 'monthly' | 'yearly' = 'monthly') {
    // Validate the target plan
    if (plan !== 'STARTER' && plan !== 'PROFESSIONAL') {
      throw new BadRequestError('Invalid plan. Must be STARTER or PROFESSIONAL.');
    }

    const subscription = await this.getByOrgId(orgId);

    // Prevent upgrading to the same plan
    if (subscription.plan === plan) {
      throw new BadRequestError('You are already on this plan.');
    }

    const amount = await planConfigService.getPrice(plan, billingCycle);
    if (!amount) {
      throw new BadRequestError('Plan price not configured.');
    }

    const currency = 'USD';
    const redirectUrl = `${config.frontendUrl}/billing?status=success&gateway=paypal`;
    const failureRedirectUrl = `${config.frontendUrl}/billing?status=canceled`;

    // Delegate to PayPalProvider
    const provider = getPaymentProvider(PaymentGateway.PAYPAL);
    return await provider.createCheckout({
      orgId,
      plan,
      billingCycle,
      amount,
      currency,
      redirectUrl,
      failureRedirectUrl,
    });
  }

  /**
   * Confirm a PayPal payment from order ID.
   */
  async confirmPayPalPayment(orgId: string, orderId: string) {
    // Delegate to PayPalProvider
    const provider = getPaymentProvider(PaymentGateway.PAYPAL);
    await provider.confirmPayment({
      orgId,
      paymentId: orderId,
    });

    return this.getByOrgId(orgId);
  }

  /**
   * Verify a Kashier webhook signature.
   */
  async verifyWebhookSignature(rawBody: string, signature: string): Promise<boolean> {
    // Delegate to KashierProvider
    const provider = getPaymentProvider(PaymentGateway.KASHIER);

    // Create a mock Request object with required properties
    const mockReq = {
      headers: { 'x-kashier-signature': signature },
      rawBody,
    } as any;

    return provider.verifyWebhook(mockReq);
  }

  /**
   * Handle a Kashier payment webhook event.
   */
  async handlePaymentWebhook(payload: KashierWebhookPayload) {
    // Delegate to KashierProvider
    const provider = getPaymentProvider(PaymentGateway.KASHIER);
    await provider.handleWebhook(payload as any);
  }

  /**
   * Verify a Stripe webhook signature.
   */
  async verifyStripeWebhookSignature(rawBody: string, signature: string): Promise<Stripe.Event> {
    // Delegate verification to StripeProvider
    const provider = getPaymentProvider(PaymentGateway.STRIPE);

    // Create a mock Request object with required properties
    const mockReq = {
      headers: { 'stripe-signature': signature },
      rawBody,
    } as any;

    const isValid = await provider.verifyWebhook(mockReq);
    if (!isValid) {
      throw new BadRequestError('Invalid Stripe webhook signature.');
    }

    // Stripe's verification requires constructing the event, so we need to construct it
    // to return it. This is a limitation of Stripe's SDK where verification and event
    // construction are tied together.
    let secretKey: string;
    let webhookSecret: string;

    try {
      secretKey = await configService.get('STRIPE_SECRET_KEY');
    } catch {
      secretKey = '';
    }
    if (!secretKey) {
      secretKey = config.stripe.secretKey;
    }

    try {
      webhookSecret = await configService.get('STRIPE_WEBHOOK_SECRET');
    } catch {
      webhookSecret = '';
    }
    if (!webhookSecret) {
      webhookSecret = config.stripe.webhookSecret;
    }

    if (!secretKey) {
      throw new BadRequestError(
        'Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment.',
      );
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
    });

    try {
      return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      logger.error({ error }, 'Stripe webhook signature verification failed');
      throw new BadRequestError('Invalid Stripe webhook signature.');
    }
  }

  /**
   * Handle a Stripe webhook event.
   */
  async handleStripeWebhook(event: Stripe.Event) {
    // Delegate to StripeProvider
    const provider = getPaymentProvider(PaymentGateway.STRIPE);
    await provider.handleWebhook(event as any);
  }

  /**
   * Verify a PayPal webhook signature.
   */
  async verifyPayPalWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<boolean> {
    // Delegate to PayPalProvider
    const provider = getPaymentProvider(PaymentGateway.PAYPAL);

    // Create a mock Request object with required properties
    const mockReq = {
      headers,
      rawBody,
    } as any;

    return provider.verifyWebhook(mockReq);
  }

  /**
   * Handle a PayPal webhook event.
   */
  async handlePayPalWebhook(payload: PayPalWebhookPayload) {
    // Delegate to PayPalProvider
    const provider = getPaymentProvider(PaymentGateway.PAYPAL);
    await provider.handleWebhook(payload as any);
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
  async checkUsage(orgId: string, type: 'messages' | 'agents'): Promise<boolean> {
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
  async incrementUsage(orgId: string, type: 'messages' | 'agents') {
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
  async decrementUsage(orgId: string, type: 'agents') {
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
  async getInvoices(
    orgId: string,
    { page = 1, limit = 20 }: { page?: number; limit?: number } = {},
  ) {
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
