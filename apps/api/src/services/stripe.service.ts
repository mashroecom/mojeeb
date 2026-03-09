import Stripe from 'stripe';
import { prisma } from '../config/database';
import { config } from '../config';
import { logger } from '../config/logger';
import { cache } from '../config/cache';
import { configService } from './config.service';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { planConfigService } from './planConfig.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StripeWebhookPayload {
  id: string;
  object: string;
  type: string;
  data: {
    object: any;
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Get Stripe configuration dynamically from configService.
 * Falls back to static config if configService fails.
 */
async function getStripeConfig(): Promise<{
  secretKey: string;
  webhookSecret: string;
}> {
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

  return { secretKey, webhookSecret };
}

/**
 * Get or create Stripe client instance.
 * Cached to avoid recreating on every request.
 */
let stripeClient: Stripe | null = null;

async function getStripeClient(): Promise<Stripe> {
  if (stripeClient) {
    return stripeClient;
  }

  const { secretKey } = await getStripeConfig();

  if (!secretKey) {
    throw new BadRequestError('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment.');
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  });

  return stripeClient;
}

export class StripeService {
  /**
   * Create a Stripe Checkout Session for upgrading to a paid plan.
   */
  async createCheckoutSession(orgId: string, plan: string) {
    // Validate the target plan
    if (plan !== 'STARTER' && plan !== 'PROFESSIONAL') {
      throw new BadRequestError('Invalid plan. Must be STARTER or PROFESSIONAL.');
    }

    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    // Prevent upgrading to the same plan
    if (subscription.plan === plan) {
      throw new BadRequestError('You are already on this plan.');
    }

    const amount = await planConfigService.getPrice(plan);
    if (!amount) {
      throw new BadRequestError('Plan price not configured.');
    }

    const stripe = await getStripeClient();

    // Get or create Stripe customer
    let customerId = subscription.stripeCustomerId;

    if (!customerId) {
      // Fetch org details for customer metadata
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, slug: true },
      });

      const customer = await stripe.customers.create({
        metadata: {
          orgId,
          orgName: org?.name || '',
          orgSlug: org?.slug || '',
        },
      });

      customerId = customer.id;

      // Save customer ID to subscription
      await prisma.subscription.update({
        where: { orgId },
        data: { stripeCustomerId: customerId },
      });

      logger.info({ orgId, customerId }, 'Created Stripe customer');
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Mojeeb ${plan} Plan`,
              description: `Monthly subscription to Mojeeb ${plan} plan`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        orgId,
        plan,
      },
      success_url: `${config.frontendUrl}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontendUrl}/billing?status=cancelled`,
    });

    logger.info({ orgId, plan, sessionId: session.id }, 'Stripe checkout session created');

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  /**
   * Create a Stripe subscription directly (used by webhook after successful checkout).
   */
  async createSubscription(orgId: string, stripeSubscriptionId: string, plan: string) {
    const stripe = await getStripeClient();

    // Retrieve the subscription from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    // Update the subscription in database
    const subscription = await prisma.subscription.update({
      where: { orgId },
      data: {
        plan: plan as any,
        status: 'ACTIVE',
        paymentGateway: 'STRIPE',
        stripeSubscriptionId,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    });

    // Update usage limits based on new plan
    const limits = await planConfigService.getLimits(plan as any);
    await prisma.subscription.update({
      where: { orgId },
      data: {
        messagesLimit: limits.messagesPerMonth,
        agentsLimit: limits.maxAgents,
        integrationsLimit: limits.maxChannels,
      },
    });

    // Clear subscription cache
    await cache.del(`subscription:${orgId}`);

    logger.info({ orgId, plan, stripeSubscriptionId }, 'Stripe subscription activated');

    return subscription;
  }

  /**
   * Cancel a Stripe subscription.
   * Sets the subscription to cancel at the end of the current period.
   */
  async cancelSubscription(orgId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    if (subscription.paymentGateway !== 'STRIPE') {
      throw new BadRequestError('This subscription is not managed by Stripe.');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestError('No Stripe subscription ID found.');
    }

    const stripe = await getStripeClient();

    // Cancel the subscription at period end
    const stripeSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    // Update local subscription
    await prisma.subscription.update({
      where: { orgId },
      data: {
        cancelAtPeriodEnd: true,
      },
    });

    // Clear cache
    await cache.del(`subscription:${orgId}`);

    logger.info({ orgId, stripeSubscriptionId: subscription.stripeSubscriptionId }, 'Stripe subscription cancelled');

    return {
      cancelledAt: new Date(),
      effectiveUntil: new Date(stripeSubscription.current_period_end * 1000),
    };
  }

  /**
   * Get Stripe subscription details.
   */
  async getSubscription(orgId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    if (subscription.paymentGateway !== 'STRIPE') {
      throw new BadRequestError('This subscription is not managed by Stripe.');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestError('No Stripe subscription ID found.');
    }

    const stripe = await getStripeClient();
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);

    return {
      id: stripeSubscription.id,
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    };
  }

  /**
   * Handle successful payment from Stripe Checkout Session.
   */
  async handleCheckoutComplete(sessionId: string) {
    const stripe = await getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'invoice'],
    });

    if (!session.metadata?.orgId || !session.metadata?.plan) {
      throw new BadRequestError('Invalid checkout session metadata.');
    }

    const { orgId, plan } = session.metadata;
    const stripeSubscriptionId = session.subscription as string;

    if (!stripeSubscriptionId) {
      throw new BadRequestError('No subscription ID in checkout session.');
    }

    // Create/update subscription
    await this.createSubscription(orgId, stripeSubscriptionId, plan);

    // Create invoice record
    const invoice = session.invoice as Stripe.Invoice;
    if (invoice) {
      await this.createInvoiceFromStripe(orgId, invoice);
    }

    logger.info({ orgId, plan, sessionId }, 'Stripe checkout completed successfully');

    return { success: true, orgId, plan };
  }

  /**
   * Create invoice record from Stripe invoice.
   */
  async createInvoiceFromStripe(orgId: string, stripeInvoice: Stripe.Invoice) {
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    // Check if invoice already exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { stripeInvoiceId: stripeInvoice.id },
    });

    if (existingInvoice) {
      logger.info({ invoiceId: stripeInvoice.id }, 'Invoice already exists, skipping creation');
      return existingInvoice;
    }

    const invoice = await prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        amount: stripeInvoice.amount_paid / 100, // Convert from cents
        currency: stripeInvoice.currency.toUpperCase(),
        status: stripeInvoice.status === 'paid' ? 'PAID' : 'PENDING',
        paymentGateway: 'STRIPE',
        stripeInvoiceId: stripeInvoice.id,
        stripePaymentIntentId: stripeInvoice.payment_intent as string,
        paidAt: stripeInvoice.status_transitions.paid_at
          ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
          : null,
        dueDate: new Date(stripeInvoice.due_date ? stripeInvoice.due_date * 1000 : Date.now()),
      },
    });

    logger.info({ orgId, invoiceId: invoice.id, stripeInvoiceId: stripeInvoice.id }, 'Stripe invoice created');

    return invoice;
  }

  /**
   * Handle invoice payment succeeded event.
   */
  async handleInvoicePaymentSucceeded(stripeInvoice: Stripe.Invoice) {
    // Get subscription by Stripe subscription ID
    const stripeSubscriptionId = stripeInvoice.subscription as string;

    if (!stripeSubscriptionId) {
      logger.warn({ invoiceId: stripeInvoice.id }, 'Invoice has no subscription ID, skipping');
      return;
    }

    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      logger.warn({ stripeSubscriptionId }, 'Subscription not found for invoice payment');
      return;
    }

    // Create invoice record
    await this.createInvoiceFromStripe(subscription.orgId, stripeInvoice);

    // Update invoice status if it exists
    await prisma.invoice.updateMany({
      where: { stripeInvoiceId: stripeInvoice.id },
      data: {
        status: 'PAID',
        paidAt: new Date(stripeInvoice.status_transitions.paid_at! * 1000),
      },
    });

    logger.info({ orgId: subscription.orgId, invoiceId: stripeInvoice.id }, 'Invoice payment succeeded');
  }

  /**
   * Handle invoice payment failed event.
   */
  async handleInvoicePaymentFailed(stripeInvoice: Stripe.Invoice) {
    const stripeSubscriptionId = stripeInvoice.subscription as string;

    if (!stripeSubscriptionId) {
      logger.warn({ invoiceId: stripeInvoice.id }, 'Invoice has no subscription ID, skipping');
      return;
    }

    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      logger.warn({ stripeSubscriptionId }, 'Subscription not found for invoice payment failure');
      return;
    }

    // Update invoice status
    await prisma.invoice.updateMany({
      where: { stripeInvoiceId: stripeInvoice.id },
      data: {
        status: 'FAILED',
      },
    });

    logger.warn({ orgId: subscription.orgId, invoiceId: stripeInvoice.id }, 'Invoice payment failed');
  }

  /**
   * Handle subscription updated event.
   */
  async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSubscription.id },
    });

    if (!subscription) {
      logger.warn({ stripeSubscriptionId: stripeSubscription.id }, 'Subscription not found for update');
      return;
    }

    // Update subscription details
    await prisma.subscription.update({
      where: { stripeSubscriptionId: stripeSubscription.id },
      data: {
        status: stripeSubscription.status === 'active' ? 'ACTIVE' : 'CANCELED',
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    });

    // Clear cache
    await cache.del(`subscription:${subscription.orgId}`);

    logger.info({ orgId: subscription.orgId, stripeSubscriptionId: stripeSubscription.id }, 'Subscription updated');
  }

  /**
   * Handle subscription deleted event.
   */
  async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSubscription.id },
    });

    if (!subscription) {
      logger.warn({ stripeSubscriptionId: stripeSubscription.id }, 'Subscription not found for deletion');
      return;
    }

    // Downgrade to FREE plan
    const freeLimit = await planConfigService.getLimits('FREE' as any);

    await prisma.subscription.update({
      where: { stripeSubscriptionId: stripeSubscription.id },
      data: {
        plan: 'FREE',
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        messagesLimit: freeLimit.messagesPerMonth,
        agentsLimit: freeLimit.maxAgents,
        integrationsLimit: freeLimit.maxChannels,
      },
    });

    // Clear cache
    await cache.del(`subscription:${subscription.orgId}`);

    logger.info({ orgId: subscription.orgId, stripeSubscriptionId: stripeSubscription.id }, 'Subscription deleted, downgraded to FREE');
  }

  /**
   * Verify Stripe webhook signature.
   */
  async verifyWebhookSignature(payload: string | Buffer, signature: string): Promise<Stripe.Event> {
    const { webhookSecret } = await getStripeConfig();

    if (!webhookSecret) {
      throw new BadRequestError('Stripe webhook secret is not configured.');
    }

    const stripe = await getStripeClient();

    try {
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      logger.error({ err }, 'Stripe webhook signature verification failed');
      throw new BadRequestError(`Webhook signature verification failed: ${err.message}`);
    }
  }
}

export const stripeService = new StripeService();
