import crypto from 'crypto';
import Stripe from 'stripe';
import * as paypal from '@paypal/checkout-server-sdk';
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

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
}

export type StripeWebhookEvent = Stripe.Event & {
  type: string;
  data: {
    object: Stripe.Invoice | Stripe.Subscription | Stripe.PaymentIntent | Record<string, unknown>;
  };
};

export interface PayPalOrderResponse {
  id: string;
  status: string;
  purchase_units: Array<{
    reference_id?: string;
    amount: {
      currency_code: string;
      value: string;
    };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: {
          currency_code: string;
          value: string;
        };
      }>;
    };
  }>;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
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

    // Stripe's verification requires constructing the event, so we need to do it again
    // to return it. This is a limitation of Stripe's SDK where verification and event
    // construction are tied together.
    // Get Stripe config directly (helper functions removed)
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
   * Handle checkout.session.completed event.
   */
  private async handleStripeCheckoutCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;

    logger.info({ sessionId: session.id }, 'Stripe checkout session completed');

    if (session.payment_status !== 'paid') {
      logger.info(
        { sessionId: session.id, status: session.payment_status },
        'Payment not completed yet',
      );
      return;
    }

    // Find the invoice by Stripe session ID
    const invoice = await prisma.invoice.findUnique({
      where: { stripeInvoiceId: session.id },
      include: { subscription: true },
    });

    if (!invoice) {
      logger.warn({ sessionId: session.id }, 'Invoice not found for Stripe checkout session');
      return;
    }

    // Already processed
    if (invoice.status === 'PAID') {
      logger.info({ sessionId: session.id }, 'Invoice already marked as paid');
      return;
    }

    // Determine the new plan from the payment amount
    const amount = parseFloat(String(invoice.amount));
    const stripePlanResult = await planConfigService.getPlanByPrice(amount);
    if (!stripePlanResult) {
      logger.error({ amount }, 'Unknown payment amount - cannot determine plan');
      return;
    }

    const { plan: newPlan } = stripePlanResult;
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
        paymentGateway: 'STRIPE',
        stripeCustomerId: session.customer as string,
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
        stripePaymentIntentId: session.payment_intent as string,
        paidAt: now,
      },
    });

    await cache.del(`subscription:${invoice.subscription.orgId}`);

    logger.info(
      { orgId: invoice.subscription.orgId, newPlan },
      'Subscription upgraded successfully via Stripe',
    );
  }

  /**
   * Handle payment_intent.succeeded event.
   */
  private async handleStripePaymentSucceeded(event: Stripe.Event) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    logger.info({ paymentIntentId: paymentIntent.id }, 'Stripe payment intent succeeded');

    // This is typically handled by checkout.session.completed
    // but we log it for completeness
  }

  /**
   * Handle payment_intent.payment_failed event.
   */
  private async handleStripePaymentFailed(event: Stripe.Event) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    logger.warn({ paymentIntentId: paymentIntent.id }, 'Stripe payment intent failed');

    // Find invoice by payment intent ID
    const invoice = await prisma.invoice.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (invoice && invoice.status !== 'FAILED') {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'FAILED' },
      });

      logger.info({ invoiceId: invoice.id }, 'Invoice marked as failed');
    }
  }

  /**
   * Handle invoice.paid event.
   */
  private async handleStripeInvoicePaid(event: Stripe.Event) {
    const stripeInvoice = event.data.object as Stripe.Invoice;

    logger.info({ invoiceId: stripeInvoice.id }, 'Stripe invoice paid');

    // This is typically handled by checkout.session.completed
    // but we log it for completeness
  }

  /**
   * Handle invoice.payment_failed event.
   */
  private async handleStripeInvoicePaymentFailed(event: Stripe.Event) {
    const stripeInvoice = event.data.object as Stripe.Invoice;

    logger.warn({ invoiceId: stripeInvoice.id }, 'Stripe invoice payment failed');
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
   * Handle PAYMENT.CAPTURE.COMPLETED event.
   */
  private async handlePayPalCaptureCompleted(payload: PayPalWebhookPayload) {
    const resource = payload.resource;
    const orderId = resource.id;

    logger.info({ orderId }, 'PayPal payment capture completed');

    // Find the invoice by PayPal order ID
    const invoice = await prisma.invoice.findFirst({
      where: {
        paypalOrderId: orderId,
      },
      include: { subscription: true },
    });

    if (!invoice) {
      logger.warn({ orderId }, 'Invoice not found for PayPal webhook');
      return;
    }

    // Already processed
    if (invoice.status === 'PAID') {
      logger.info({ orderId }, 'Invoice already marked as paid');
      return;
    }

    // Determine the new plan from the payment amount
    const amount = parseFloat(String(invoice.amount));
    const paypalPlanResult = await planConfigService.getPlanByPrice(amount);
    if (!paypalPlanResult) {
      logger.error({ amount }, 'Unknown payment amount - cannot determine plan');
      return;
    }

    const { plan: newPlan } = paypalPlanResult;
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
        paymentGateway: 'PAYPAL',
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
        paypalCaptureId: resource.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null,
        paidAt: now,
      },
    });

    await cache.del(`subscription:${invoice.subscription.orgId}`);

    logger.info(
      { orgId: invoice.subscription.orgId, newPlan },
      'Subscription upgraded successfully via PayPal',
    );
  }

  /**
   * Handle PAYMENT.CAPTURE.DENIED/DECLINED events.
   */
  private async handlePayPalCaptureFailed(payload: PayPalWebhookPayload) {
    const resource = payload.resource;
    const orderId = resource.id;

    logger.warn({ orderId }, 'PayPal payment capture failed');

    // Find invoice by PayPal order ID
    const invoice = await prisma.invoice.findFirst({
      where: {
        paypalOrderId: orderId,
      },
    });

    if (invoice && invoice.status !== 'FAILED') {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'FAILED' },
      });

      logger.info({ invoiceId: invoice.id }, 'Invoice marked as failed');
    }
  }

  /**
   * Handle CHECKOUT.ORDER.APPROVED event.
   */
  private async handlePayPalOrderApproved(payload: PayPalWebhookPayload) {
    const resource = payload.resource;
    const orderId = resource.id;

    logger.info({ orderId }, 'PayPal order approved (awaiting capture)');

    // We don't update the subscription yet, waiting for capture confirmation
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
