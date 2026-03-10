import Stripe from 'stripe';
import type { Request } from 'express';
import { config } from '../../config';
import { configService } from '../config.service';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { cache } from '../../config/cache';
import { planConfigService } from '../planConfig.service';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import {
  PaymentProvider,
  CheckoutResponse,
  PaymentConfirmation,
  WebhookPayload,
  CheckoutParams,
  PaymentConfirmationParams,
} from './PaymentProvider';

// ---------------------------------------------------------------------------
// Stripe-specific Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Convert Infinity to a large integer safe for Prisma/PostgreSQL.
 */
function safeLimit(value: number): number {
  return Number.isFinite(value) ? value : 999999;
}

// ---------------------------------------------------------------------------
// Stripe Provider Implementation
// ---------------------------------------------------------------------------

export class StripeProvider extends PaymentProvider {
  readonly name = 'STRIPE';
  private client: Stripe | null = null;
  private cachedSecretKey: string = '';
  private cachedConfig: {
    secretKey: string;
    webhookSecret: string;
  } | null = null;
  private lastConfigFetch: number = 0;
  private readonly CONFIG_TTL = 60000; // 1 minute

  /**
   * Get Stripe configuration dynamically from configService.
   * Recreates the config if it has changed or expired.
   * Falls back to static config if configService fails.
   */
  private async getStripeConfig(): Promise<{
    secretKey: string;
    webhookSecret: string;
  }> {
    const now = Date.now();
    if (this.cachedConfig && now - this.lastConfigFetch < this.CONFIG_TTL) {
      return this.cachedConfig;
    }

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

    this.cachedConfig = { secretKey, webhookSecret };
    this.lastConfigFetch = now;

    return this.cachedConfig;
  }

  /**
   * Get or lazily create the Stripe client.
   * Recreates the client if the API key has changed (e.g. updated via admin dashboard).
   * Falls back to static config if configService fails.
   */
  private async getClient(): Promise<Stripe> {
    const stripeConfig = await this.getStripeConfig();
    if (!stripeConfig.secretKey) {
      throw new BadRequestError(
        'Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment.',
      );
    }
    if (!this.client || this.cachedSecretKey !== stripeConfig.secretKey) {
      this.client = new Stripe(stripeConfig.secretKey, {
        apiVersion: '2025-02-24.acacia',
      });
      this.cachedSecretKey = stripeConfig.secretKey;
    }
    return this.client;
  }

  /**
   * Create a Stripe checkout session for upgrading to a paid plan.
   */
  async createCheckout(params: CheckoutParams): Promise<CheckoutResponse> {
    const { orgId, plan, billingCycle, amount, currency, redirectUrl, failureRedirectUrl } =
      params;

    const stripe = await this.getClient();

    // Find subscription to get/create Stripe customer
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    // Get or create Stripe customer
    let customerId = subscription.stripeCustomerId;
    if (!customerId) {
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) throw new NotFoundError('Organization not found');

      const customer = await stripe.customers.create({
        metadata: {
          orgId,
          plan,
        },
      });
      customerId = customer.id;

      await prisma.subscription.update({
        where: { orgId },
        data: { stripeCustomerId: customerId },
      });
      await cache.del(`subscription:${orgId}`);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: Math.round(amount * 100), // Convert to cents
            product_data: {
              name: `Mojeeb ${plan} Plan`,
              description: `${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} subscription to Mojeeb ${plan} plan`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: redirectUrl,
      cancel_url: failureRedirectUrl,
      metadata: {
        orgId,
        plan,
        subscriptionId: subscription.id,
      },
    });

    // Store the pending invoice
    await prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        amount,
        currency: currency.toUpperCase(),
        status: 'PENDING',
        paymentGateway: 'STRIPE',
        stripeInvoiceId: session.id,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
      },
    });

    logger.info({ orgId, plan, sessionId: session.id }, 'Stripe checkout session created');

    return {
      checkoutUrl: session.url || '',
      orderId: session.id,
    };
  }

  /**
   * Confirm a Stripe payment from checkout session.
   * This is used when the webhook can't reach the server (e.g., localhost).
   */
  async confirmPayment(params: PaymentConfirmationParams): Promise<PaymentConfirmation> {
    const { orgId, paymentId } = params;
    const sessionId = paymentId;

    const stripe = await this.getClient();

    logger.info({ orgId, sessionId }, 'Confirming Stripe payment from checkout');

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      throw new BadRequestError('Payment was not successful.');
    }

    // Find the invoice by Stripe session ID
    const invoice = await prisma.invoice.findUnique({
      where: { stripeInvoiceId: sessionId },
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
      const paidAmountNum = (session.amount_total || 0) / 100; // Convert from cents
      return {
        success: true,
        transactionId: session.payment_intent as string,
        amount: paidAmountNum,
        currency: session.currency || 'usd',
      };
    }

    // Verify amount matches
    const paidAmountNum = (session.amount_total || 0) / 100; // Convert from cents
    const invoiceAmountNum = parseFloat(String(invoice.amount));
    logger.info({ paidAmountNum, invoiceAmountNum }, 'Comparing payment amounts');
    if (Math.abs(paidAmountNum - invoiceAmountNum) > 0.01) {
      throw new BadRequestError(
        `Payment amount (${paidAmountNum}) does not match invoice amount (${invoiceAmountNum}).`,
      );
    }

    // Determine the new plan from the payment amount
    const planResult = await planConfigService.getPlanByPrice(invoiceAmountNum);
    if (!planResult) {
      throw new BadRequestError('Unknown payment amount — cannot determine plan.');
    }

    const { plan: newPlan, billingCycle } = planResult;
    const limits = await planConfigService.getLimits(newPlan);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

    // Update subscription with new plan
    await prisma.subscription.update({
      where: { id: invoice.subscriptionId },
      data: {
        plan: newPlan,
        status: 'ACTIVE',
        paymentGateway: 'STRIPE',
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

    await cache.del(`subscription:${orgId}`);

    logger.info({ orgId, newPlan, sessionId }, 'Stripe payment confirmed, subscription upgraded');

    return {
      success: true,
      transactionId: session.payment_intent as string,
      amount: paidAmountNum,
      currency: session.currency || 'usd',
    };
  }

  /**
   * Verify a Stripe webhook signature.
   */
  async verifyWebhook(req: Request): Promise<boolean> {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      logger.warn('Missing Stripe webhook signature');
      return false;
    }

    const rawBody = (req as Request & { rawBody?: string }).rawBody;
    if (!rawBody) {
      logger.warn('Missing raw body for webhook verification');
      return false;
    }

    const stripeConfig = await this.getStripeConfig();
    if (!stripeConfig.webhookSecret) {
      logger.warn('Stripe webhook secret is not configured');
      return false;
    }

    try {
      const stripe = await this.getClient();
      stripe.webhooks.constructEvent(rawBody, signature, stripeConfig.webhookSecret);
      return true;
    } catch (error) {
      logger.error({ error }, 'Stripe webhook signature verification failed');
      return false;
    }
  }

  /**
   * Handle a Stripe webhook event.
   */
  async handleWebhook(payload: WebhookPayload): Promise<void> {
    const event = payload as unknown as Stripe.Event;

    logger.info({ type: event.type, id: event.id }, 'Processing Stripe webhook');

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event);
        break;
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(event);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event);
        break;
      default:
        logger.info({ type: event.type }, 'Unhandled Stripe webhook event type');
    }
  }

  /**
   * Handle checkout.session.completed event.
   */
  private async handleCheckoutCompleted(event: Stripe.Event) {
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

    const { plan: newPlan, billingCycle } = stripePlanResult;
    const limits = await planConfigService.getLimits(newPlan);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

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
  private async handlePaymentSucceeded(event: Stripe.Event) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    logger.info({ paymentIntentId: paymentIntent.id }, 'Stripe payment intent succeeded');

    // This is typically handled by checkout.session.completed
    // but we log it for completeness
  }

  /**
   * Handle payment_intent.payment_failed event.
   */
  private async handlePaymentFailed(event: Stripe.Event) {
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
  private async handleInvoicePaid(event: Stripe.Event) {
    const stripeInvoice = event.data.object as Stripe.Invoice;

    logger.info({ invoiceId: stripeInvoice.id }, 'Stripe invoice paid');

    // This is typically handled by checkout.session.completed
    // but we log it for completeness
  }

  /**
   * Handle invoice.payment_failed event.
   */
  private async handleInvoicePaymentFailed(event: Stripe.Event) {
    const stripeInvoice = event.data.object as Stripe.Invoice;

    logger.warn({ invoiceId: stripeInvoice.id }, 'Stripe invoice payment failed');
  }
}
