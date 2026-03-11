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

/**
 * Kashier webhook payload structure.
 * Re-exported from KashierProvider for public API usage.
 */
export interface KashierWebhookPayload {
  /** Event type (e.g., 'payment.success') */
  event: string;
  /** Event data containing payment details */
  data: {
    /** Kashier's order ID */
    orderId: string;
    /** Merchant's order reference ID */
    merchantOrderId: string;
    /** Unique transaction ID */
    transactionId: string;
    /** Payment amount in smallest currency unit */
    amount: number;
    /** Currency code (e.g., 'USD') */
    currency: string;
    /** Payment status */
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    /** Customer reference from checkout */
    customerReference: string;
    /** Payment method used (e.g., 'card', 'wallet') */
    paymentMethod: string;
  };
}

/**
 * PayPal webhook payload structure.
 * Re-exported from PayPalProvider for public API usage.
 */
export interface PayPalWebhookPayload {
  /** PayPal event type (e.g., 'CHECKOUT.ORDER.APPROVED') */
  event_type: string;
  /** Event resource containing order details */
  resource: {
    /** PayPal order/resource ID */
    id: string;
    /** Order status */
    status: string;
    /** Purchase units (items being purchased) */
    purchase_units?: Array<{
      /** Merchant's reference ID */
      reference_id: string;
      /** Payment amount details */
      amount: {
        /** Amount value as string */
        value: string;
        /** Currency code */
        currency_code: string;
      };
      /** Payment capture details */
      payments?: {
        /** Captured payments */
        captures?: Array<{
          /** Capture ID */
          id: string;
          /** Capture status */
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
 *
 * PostgreSQL integers have a maximum value, so we convert Infinity
 * (used in plan configs for unlimited) to a large but finite number.
 *
 * @param value - The value to convert
 * @returns The original value if finite, otherwise 999999
 */
function safeLimit(value: number): number {
  return Number.isFinite(value) ? value : 999999;
}

/**
 * Provider instances cache for singleton pattern.
 * Ensures only one instance of each payment provider exists.
 */
const providerInstances: Partial<Record<PaymentGateway, PaymentProvider>> = {};

/**
 * Get or create a payment provider instance for the specified gateway.
 *
 * Uses the singleton pattern to ensure only one instance per provider type
 * exists in memory. This improves performance and maintains consistent state.
 *
 * @param gateway - The payment gateway type (KASHIER, STRIPE, or PAYPAL)
 * @returns Payment provider instance implementing PaymentProvider interface
 * @throws {BadRequestError} If the gateway type is not supported
 */
function getPaymentProvider(gateway: PaymentGateway): PaymentProvider {
  // Return existing instance if already created
  if (!providerInstances[gateway]) {
    // Create new instance based on gateway type
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

/**
 * Subscription service for managing organization subscriptions and billing.
 *
 * Handles subscription lifecycle including:
 * - Creating checkout sessions for plan upgrades
 * - Processing payment confirmations
 * - Managing webhook events from payment providers
 * - Enforcing usage limits
 * - Tracking invoices
 *
 * Uses the Strategy Pattern via PaymentProvider implementations to support
 * multiple payment gateways (Kashier, Stripe, PayPal) with consistent logic.
 */
export class SubscriptionService {
  /**
   * Get subscription by organization ID.
   *
   * Results are cached for 5 minutes to improve performance.
   *
   * @param orgId - Organization ID
   * @returns Subscription record
   * @throws {NotFoundError} If subscription not found
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
   *
   * Validates the plan, retrieves pricing, and delegates to KashierProvider
   * to create the checkout session. Returns a URL where the user should be
   * redirected to complete payment.
   *
   * @param orgId - Organization ID
   * @param plan - Target plan (STARTER or PROFESSIONAL)
   * @param billingCycle - Billing frequency (default: monthly)
   * @returns Checkout response with URL and order ID
   * @throws {BadRequestError} If plan is invalid, already on plan, or price not configured
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
   * Confirm a Kashier payment from redirect parameters.
   *
   * Used as a fallback when webhooks can't reach the server (e.g., localhost).
   * Validates payment status and delegates to KashierProvider for processing.
   *
   * @param orgId - Organization ID
   * @param params - Payment parameters from Kashier redirect
   * @returns Updated subscription record
   * @throws {BadRequestError} If payment failed or amount doesn't match
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
   *
   * Validates the plan, retrieves pricing, and delegates to StripeProvider
   * to create the checkout session.
   *
   * @param orgId - Organization ID
   * @param plan - Target plan (STARTER or PROFESSIONAL)
   * @param billingCycle - Billing frequency (default: monthly)
   * @returns Checkout response with URL and session ID
   * @throws {BadRequestError} If plan is invalid, already on plan, or price not configured
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
   *
   * Verifies the payment was successful and processes the subscription upgrade.
   *
   * @param orgId - Organization ID
   * @param sessionId - Stripe checkout session ID
   * @returns Updated subscription record
   * @throws {BadRequestError} If payment failed or session not found
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
   *
   * Validates the plan, retrieves pricing, and delegates to PayPalProvider
   * to create the checkout session.
   *
   * @param orgId - Organization ID
   * @param plan - Target plan (STARTER or PROFESSIONAL)
   * @param billingCycle - Billing frequency (default: monthly)
   * @returns Checkout response with URL and order ID
   * @throws {BadRequestError} If plan is invalid, already on plan, or price not configured
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
   *
   * Verifies the payment was successful and processes the subscription upgrade.
   *
   * @param orgId - Organization ID
   * @param orderId - PayPal order ID
   * @returns Updated subscription record
   * @throws {BadRequestError} If payment failed or order not found
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
   *
   * Validates the authenticity of a webhook request from Kashier by verifying
   * the cryptographic signature. Prevents unauthorized webhook events.
   *
   * @param rawBody - Raw webhook request body
   * @param signature - Signature from X-Kashier-Signature header
   * @returns True if signature is valid, false otherwise
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
   *
   * Processes asynchronous payment notifications from Kashier.
   * Delegates to KashierProvider for event processing.
   *
   * @param payload - Kashier webhook payload
   */
  async handlePaymentWebhook(payload: KashierWebhookPayload) {
    // Delegate to KashierProvider
    const provider = getPaymentProvider(PaymentGateway.KASHIER);
    await provider.handleWebhook(payload as any);
  }

  /**
   * Verify a Stripe webhook signature and construct event.
   *
   * Validates the authenticity of a webhook request from Stripe by verifying
   * the cryptographic signature. Constructs and returns the Stripe event object.
   *
   * Note: Stripe's SDK requires constructing the event during verification,
   * so this method returns the event instead of just a boolean.
   *
   * @param rawBody - Raw webhook request body
   * @param signature - Signature from Stripe-Signature header
   * @returns Constructed Stripe event object
   * @throws {BadRequestError} If signature is invalid or Stripe not configured
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
   *
   * Processes asynchronous payment notifications from Stripe.
   * Delegates to StripeProvider for event processing.
   *
   * @param event - Stripe event object (from verifyStripeWebhookSignature)
   */
  async handleStripeWebhook(event: Stripe.Event) {
    // Delegate to StripeProvider
    const provider = getPaymentProvider(PaymentGateway.STRIPE);
    await provider.handleWebhook(event as any);
  }

  /**
   * Verify a PayPal webhook signature.
   *
   * Validates the authenticity of a webhook request from PayPal by verifying
   * the cryptographic signature in the request headers.
   *
   * @param rawBody - Raw webhook request body
   * @param headers - Request headers containing PayPal signature
   * @returns True if signature is valid, false otherwise
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
   *
   * Processes asynchronous payment notifications from PayPal.
   * Delegates to PayPalProvider for event processing.
   *
   * @param payload - PayPal webhook payload
   */
  async handlePayPalWebhook(payload: PayPalWebhookPayload) {
    // Delegate to PayPalProvider
    const provider = getPaymentProvider(PaymentGateway.PAYPAL);
    await provider.handleWebhook(payload as any);
  }

  /**
   * Cancel a subscription.
   *
   * Two cancellation modes:
   * - Immediate (immediate=true): Downgrade to FREE plan immediately
   * - Scheduled (immediate=false): Mark for cancellation at period end
   *
   * @param orgId - Organization ID
   * @param immediate - If true, downgrade immediately; if false, cancel at period end
   * @returns Updated subscription record
   * @throws {BadRequestError} If already on FREE plan
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
   *
   * Verifies whether the organization can perform an action based on
   * their current plan's limits and usage.
   *
   * @param orgId - Organization ID
   * @param type - Usage type to check (messages or agents)
   * @returns True if usage is allowed (under limit), false if at/over limit
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
   * Increment a usage counter.
   *
   * Checks if usage is allowed, increments the counter, and clears cache.
   *
   * @param orgId - Organization ID
   * @param type - Usage type to increment (messages or agents)
   * @throws {UsageLimitError} If the usage limit has been reached
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
   * Decrement a usage counter.
   *
   * Used when removing resources (e.g., deleting an agent).
   * Clears cache to ensure fresh data on next read.
   *
   * @param orgId - Organization ID
   * @param type - Usage type to decrement (currently only 'agents')
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
   * Sync agentsUsed counter with actual agent count in database.
   *
   * Useful for fixing any drift between the counter and actual data,
   * such as after data imports or migrations.
   *
   * @param orgId - Organization ID
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
   *
   * Returns invoices sorted by creation date (newest first) with pagination.
   *
   * @param orgId - Organization ID
   * @param options - Pagination options (page and limit)
   * @returns Invoices array and pagination metadata
   * @throws {NotFoundError} If subscription not found
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
   *
   * Verifies the invoice belongs to the specified organization
   * before returning it.
   *
   * @param orgId - Organization ID
   * @param invoiceId - Invoice ID
   * @returns Invoice record
   * @throws {NotFoundError} If subscription or invoice not found
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
