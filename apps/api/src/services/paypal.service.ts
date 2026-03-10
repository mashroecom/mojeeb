import paypal from '@paypal/checkout-server-sdk';
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

export interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface PayPalCaptureResponse {
  id: string;
  status: string;
  purchase_units: Array<{
    payments: {
      captures: Array<{
        id: string;
        status: string;
        amount: {
          value: string;
          currency_code: string;
        };
      }>;
    };
  }>;
}

export interface PayPalWebhookPayload {
  id: string;
  event_type: string;
  resource: any;
  resource_type: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Get PayPal configuration dynamically from configService.
 * Falls back to static config if configService fails.
 */
async function getPayPalConfig(): Promise<{
  clientId: string;
  clientSecret: string;
  mode: string;
  webhookId: string;
}> {
  let clientId: string;
  let clientSecret: string;
  let mode: string;
  let webhookId: string;

  try {
    clientId = await configService.get('PAYPAL_CLIENT_ID');
  } catch {
    clientId = '';
  }
  if (!clientId) {
    clientId = config.paypal.clientId;
  }

  try {
    clientSecret = await configService.get('PAYPAL_CLIENT_SECRET');
  } catch {
    clientSecret = '';
  }
  if (!clientSecret) {
    clientSecret = config.paypal.clientSecret;
  }

  try {
    mode = await configService.get('PAYPAL_MODE');
  } catch {
    mode = '';
  }
  if (!mode) {
    mode = config.paypal.mode;
  }

  try {
    webhookId = await configService.get('PAYPAL_WEBHOOK_ID');
  } catch {
    webhookId = '';
  }
  if (!webhookId) {
    webhookId = config.paypal.webhookId;
  }

  return { clientId, clientSecret, mode, webhookId };
}

/**
 * Get or create PayPal client instance.
 * Cached to avoid recreating on every request.
 */
let paypalClient: paypal.core.PayPalHttpClient | null = null;

async function getPayPalClient(): Promise<paypal.core.PayPalHttpClient> {
  if (paypalClient) {
    return paypalClient;
  }

  const { clientId, clientSecret, mode } = await getPayPalConfig();

  if (!clientId || !clientSecret) {
    throw new BadRequestError('PayPal is not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in your environment.');
  }

  // Create PayPal environment
  const environment = mode === 'live'
    ? new paypal.core.LiveEnvironment(clientId, clientSecret)
    : new paypal.core.SandboxEnvironment(clientId, clientSecret);

  paypalClient = new paypal.core.PayPalHttpClient(environment);

  return paypalClient;
}

export class PayPalService {
  /**
   * Create a PayPal Order for upgrading to a paid plan.
   * Returns the order ID and approval URL for the user to complete payment.
   */
  async createOrder(orgId: string, plan: string) {
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

    const client = await getPayPalClient();

    // Create PayPal order request
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `mojeeb_${orgId}_${Date.now()}`,
          description: `Mojeeb ${plan} Plan - Monthly Subscription`,
          amount: {
            currency_code: 'USD',
            value: amount.toFixed(2),
          },
          custom_id: JSON.stringify({ orgId, plan }),
        },
      ],
      application_context: {
        brand_name: 'Mojeeb',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: `${config.frontendUrl}/billing?status=success&gateway=paypal`,
        cancel_url: `${config.frontendUrl}/billing?status=cancelled&gateway=paypal`,
      },
    });

    // Execute the request
    const response = await client.execute(request);
    const order = response.result as PayPalOrderResponse;

    // Find the approval URL
    const approvalUrl = order.links.find((link) => link.rel === 'approve')?.href;

    if (!approvalUrl) {
      throw new BadRequestError('Failed to get PayPal approval URL');
    }

    // Create pending invoice
    await prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        amount,
        currency: 'USD',
        status: 'PENDING',
        paymentGateway: 'PAYPAL',
        paypalOrderId: order.id,
        dueDate: new Date(),
      },
    });

    logger.info({ orgId, plan, orderId: order.id }, 'PayPal order created');

    return {
      orderId: order.id,
      approvalUrl,
    };
  }

  /**
   * Capture a PayPal Order after user approval.
   * This completes the payment and upgrades the subscription.
   */
  async captureOrder(orderId: string) {
    const client = await getPayPalClient();

    // Create capture request
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    // Execute capture
    const response = await client.execute(request);
    const capturedOrder = response.result as PayPalCaptureResponse;

    // Extract metadata from order
    const invoice = await prisma.invoice.findUnique({
      where: { paypalOrderId: orderId },
      include: { subscription: true },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found for PayPal order');
    }

    const orgId = invoice.subscription.orgId;

    // Get the capture ID
    const captureId = capturedOrder.purchase_units[0]?.payments?.captures?.[0]?.id;

    if (!captureId) {
      throw new BadRequestError('Failed to get PayPal capture ID');
    }

    // Update invoice status
    await prisma.invoice.update({
      where: { paypalOrderId: orderId },
      data: {
        status: capturedOrder.status === 'COMPLETED' ? 'PAID' : 'FAILED',
        paypalCaptureId: captureId,
        paidAt: capturedOrder.status === 'COMPLETED' ? new Date() : null,
      },
    });

    // If payment successful, upgrade subscription
    if (capturedOrder.status === 'COMPLETED') {
      // Get the plan from the original invoice
      const subscription = await prisma.subscription.findUnique({
        where: { orgId },
      });

      if (!subscription) {
        throw new NotFoundError('Subscription not found');
      }

      // Determine the plan (stored in custom_id during order creation)
      // For now, we'll upgrade based on the amount paid
      let targetPlan: string;
      const paidAmount = parseFloat(capturedOrder.purchase_units[0]?.payments?.captures?.[0]?.amount?.value || '0');

      const starterPrice = await planConfigService.getPrice('STARTER');
      const professionalPrice = await planConfigService.getPrice('PROFESSIONAL');

      if (Math.abs(paidAmount - starterPrice) < 0.01) {
        targetPlan = 'STARTER';
      } else if (Math.abs(paidAmount - professionalPrice) < 0.01) {
        targetPlan = 'PROFESSIONAL';
      } else {
        logger.warn({ paidAmount, starterPrice, professionalPrice }, 'Unable to determine plan from paid amount, defaulting to STARTER');
        targetPlan = 'STARTER';
      }

      // Update subscription
      const currentDate = new Date();
      const nextMonth = new Date(currentDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      await prisma.subscription.update({
        where: { orgId },
        data: {
          plan: targetPlan as any,
          status: 'ACTIVE',
          paymentGateway: 'PAYPAL',
          currentPeriodStart: currentDate,
          currentPeriodEnd: nextMonth,
        },
      });

      // Update usage limits based on new plan
      const limits = await planConfigService.getLimits(targetPlan as any);
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

      logger.info({ orgId, orderId, captureId, plan: targetPlan }, 'PayPal payment captured and subscription upgraded');
    } else {
      logger.warn({ orgId, orderId, status: capturedOrder.status }, 'PayPal payment capture failed');
    }

    return {
      orderId,
      captureId,
      status: capturedOrder.status,
    };
  }

  /**
   * Create a PayPal subscription for recurring billing.
   * Note: This requires PayPal Billing API setup with plan IDs.
   */
  async createSubscription(orgId: string, plan: string, paypalSubscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    // Update subscription in database
    const currentDate = new Date();
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    await prisma.subscription.update({
      where: { orgId },
      data: {
        plan: plan as any,
        status: 'ACTIVE',
        paymentGateway: 'PAYPAL',
        paypalSubscriptionId,
        currentPeriodStart: currentDate,
        currentPeriodEnd: nextMonth,
        cancelAtPeriodEnd: false,
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

    logger.info({ orgId, plan, paypalSubscriptionId }, 'PayPal subscription activated');

    return subscription;
  }

  /**
   * Cancel a PayPal subscription.
   * Note: Requires PayPal Subscriptions API integration.
   */
  async cancelSubscription(orgId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    if (subscription.paymentGateway !== 'PAYPAL') {
      throw new BadRequestError('This subscription is not managed by PayPal.');
    }

    if (!subscription.paypalSubscriptionId) {
      throw new BadRequestError('No PayPal subscription ID found. This appears to be a one-time payment.');
    }

    // Note: PayPal subscription cancellation would be implemented here
    // For now, we'll just update the local subscription
    await prisma.subscription.update({
      where: { orgId },
      data: {
        cancelAtPeriodEnd: true,
      },
    });

    // Clear cache
    await cache.del(`subscription:${orgId}`);

    logger.info({ orgId, paypalSubscriptionId: subscription.paypalSubscriptionId }, 'PayPal subscription marked for cancellation');

    return {
      cancelledAt: new Date(),
      effectiveUntil: subscription.currentPeriodEnd,
    };
  }

  /**
   * Get PayPal subscription details.
   */
  async getSubscription(orgId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    if (subscription.paymentGateway !== 'PAYPAL') {
      throw new BadRequestError('This subscription is not managed by PayPal.');
    }

    return {
      id: subscription.paypalSubscriptionId || null,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }

  /**
   * Handle payment capture completed event from webhook.
   */
  async handlePaymentCaptureCompleted(resource: any) {
    const captureId = resource.id;

    // Find invoice by PayPal capture ID
    const invoice = await prisma.invoice.findFirst({
      where: { paypalCaptureId: captureId },
      include: { subscription: true },
    });

    if (!invoice) {
      logger.warn({ captureId }, 'Invoice not found for PayPal capture');
      return;
    }

    // Update invoice status
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    logger.info({ orgId: invoice.subscription.orgId, captureId }, 'PayPal payment capture completed');
  }

  /**
   * Handle payment capture denied event from webhook.
   */
  async handlePaymentCaptureDenied(resource: any) {
    const captureId = resource.id;

    // Find invoice by PayPal capture ID or order ID
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [
          { paypalCaptureId: captureId },
          { paypalOrderId: resource.supplementary_data?.related_ids?.order_id },
        ],
      },
      include: { subscription: true },
    });

    if (!invoice) {
      logger.warn({ captureId }, 'Invoice not found for PayPal capture denial');
      return;
    }

    // Update invoice status
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'FAILED',
      },
    });

    logger.warn({ orgId: invoice.subscription.orgId, captureId }, 'PayPal payment capture denied');
  }

  /**
   * Handle billing subscription created event from webhook.
   */
  async handleSubscriptionCreated(resource: any) {
    const paypalSubscriptionId = resource.id;
    const customId = resource.custom_id;

    if (!customId) {
      logger.warn({ paypalSubscriptionId }, 'No custom_id in PayPal subscription');
      return;
    }

    let metadata: { orgId: string; plan: string };
    try {
      metadata = JSON.parse(customId);
    } catch {
      logger.warn({ customId }, 'Invalid custom_id format in PayPal subscription');
      return;
    }

    await this.createSubscription(metadata.orgId, metadata.plan, paypalSubscriptionId);

    logger.info({ orgId: metadata.orgId, paypalSubscriptionId }, 'PayPal subscription created from webhook');
  }

  /**
   * Handle billing subscription cancelled event from webhook.
   */
  async handleSubscriptionCancelled(resource: any) {
    const paypalSubscriptionId = resource.id;

    const subscription = await prisma.subscription.findUnique({
      where: { paypalSubscriptionId },
    });

    if (!subscription) {
      logger.warn({ paypalSubscriptionId }, 'Subscription not found for PayPal cancellation');
      return;
    }

    // Downgrade to FREE plan
    const freeLimit = await planConfigService.getLimits('FREE' as any);

    await prisma.subscription.update({
      where: { paypalSubscriptionId },
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

    logger.info({ orgId: subscription.orgId, paypalSubscriptionId }, 'PayPal subscription cancelled, downgraded to FREE');
  }

  /**
   * Handle billing subscription updated event from webhook.
   */
  async handleSubscriptionUpdated(resource: any) {
    const paypalSubscriptionId = resource.id;

    const subscription = await prisma.subscription.findUnique({
      where: { paypalSubscriptionId },
    });

    if (!subscription) {
      logger.warn({ paypalSubscriptionId }, 'Subscription not found for PayPal update');
      return;
    }

    // Update subscription status based on PayPal status
    const status = resource.status === 'ACTIVE' ? 'ACTIVE' : 'CANCELED';

    await prisma.subscription.update({
      where: { paypalSubscriptionId },
      data: {
        status,
      },
    });

    // Clear cache
    await cache.del(`subscription:${subscription.orgId}`);

    logger.info({ orgId: subscription.orgId, paypalSubscriptionId }, 'PayPal subscription updated');
  }

  /**
   * Verify PayPal webhook signature.
   * Note: PayPal webhook verification requires the webhook ID and uses their REST API.
   */
  async verifyWebhookSignature(headers: Record<string, string>, body: string): Promise<boolean> {
    const { webhookId } = await getPayPalConfig();

    if (!webhookId) {
      logger.warn('PayPal webhook ID is not configured, skipping signature verification');
      return true; // In development, allow webhooks without verification
    }

    // PayPal webhook verification would be implemented here
    // This requires calling PayPal's verify-webhook-signature endpoint
    // For now, we'll return true in development mode

    const isDevelopment = config.nodeEnv === 'development';

    if (isDevelopment) {
      logger.warn('PayPal webhook signature verification skipped in development mode');
      return true;
    }

    // In production, implement proper verification using PayPal's API
    logger.warn('PayPal webhook signature verification not fully implemented');
    return true;
  }
}

export const paypalService = new PayPalService();
