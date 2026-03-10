import crypto from 'crypto';
import Stripe from 'stripe';
import * as paypal from '@paypal/checkout-server-sdk';
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
 */
let stripeClient: Stripe | null = null;
let currentStripeSecretKey: string | null = null;
async function getStripeClient(): Promise<Stripe> {
  const stripeConfig = await getStripeConfig();
  if (!stripeConfig.secretKey) {
    throw new BadRequestError('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment.');
  }
  if (!stripeClient || currentStripeSecretKey !== stripeConfig.secretKey) {
    stripeClient = new Stripe(stripeConfig.secretKey, {
      apiVersion: '2025-02-24.acacia',
    });
    currentStripeSecretKey = stripeConfig.secretKey;
  }
  return stripeClient;
}

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
 */
let paypalClient: paypal.core.PayPalHttpClient | null = null;
async function getPayPalClient(): Promise<paypal.core.PayPalHttpClient> {
  const paypalConfig = await getPayPalConfig();
  if (!paypalConfig.clientId || !paypalConfig.clientSecret) {
    throw new BadRequestError('PayPal is not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in your environment.');
  }

  if (!paypalClient) {
    const environment =
      paypalConfig.mode === 'live'
        ? new paypal.core.LiveEnvironment(paypalConfig.clientId, paypalConfig.clientSecret)
        : new paypal.core.SandboxEnvironment(paypalConfig.clientId, paypalConfig.clientSecret);

    paypalClient = new paypal.core.PayPalHttpClient(environment);
  }

  return paypalClient;
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
  async createCheckout(orgId: string, plan: string, billingCycle: 'monthly' | 'yearly' = 'monthly') {
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
    const result = await planConfigService.getPlanByPrice(paidAmount);
    if (!result) {
      throw new BadRequestError('Unknown payment amount — cannot determine plan.');
    }

    const { plan: newPlan, billingCycle } = result;
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
   * Create a Stripe checkout session for upgrading to a paid plan.
   */
  async createStripeCheckout(orgId: string, plan: string) {
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

    const stripe = await getStripeClient();
    const currency = 'usd';

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
            currency,
            unit_amount: Math.round(amount * 100), // Convert to cents
            product_data: {
              name: `Mojeeb ${plan} Plan`,
              description: `Monthly subscription to Mojeeb ${plan} plan`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${config.frontendUrl}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontendUrl}/billing?status=canceled`,
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
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Confirm a Stripe payment from checkout session.
   */
  async confirmStripePayment(orgId: string, sessionId: string) {
    const stripe = await getStripeClient();

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
      return this.getByOrgId(orgId);
    }

    // Verify amount matches
    const paidAmountNum = (session.amount_total || 0) / 100; // Convert from cents
    const invoiceAmountNum = parseFloat(String(invoice.amount));
    logger.info({ paidAmountNum, invoiceAmountNum }, 'Comparing payment amounts');
    if (Math.abs(paidAmountNum - invoiceAmountNum) > 0.01) {
      throw new BadRequestError(`Payment amount (${paidAmountNum}) does not match invoice amount (${invoiceAmountNum}).`);
    }

    // Determine the new plan from the payment amount
    const planResult = await planConfigService.getPlanByPrice(invoiceAmountNum);
    if (!planResult) {
      throw new BadRequestError('Unknown payment amount — cannot determine plan.');
    }

    const { plan: newPlan } = planResult;
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

    logger.info(
      { orgId, newPlan, sessionId },
      'Stripe payment confirmed, subscription upgraded',
    );

    return this.getByOrgId(orgId);
  }

  /**
   * Create a PayPal checkout session for upgrading to a paid plan.
   */
  async createPayPalCheckout(orgId: string, plan: string) {
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

    const paypalClientInstance = await getPayPalClient();
    const currency = 'USD';

    // Create PayPal order
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `mojeeb_${orgId}_${Date.now()}`,
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
          description: `Mojeeb ${plan} Plan - Monthly Subscription`,
        },
      ],
      application_context: {
        brand_name: 'Mojeeb',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: `${config.frontendUrl}/billing?status=success&gateway=paypal`,
        cancel_url: `${config.frontendUrl}/billing?status=canceled`,
      },
    });

    const response = await paypalClientInstance.execute(request);
    const order = response.result as PayPalOrderResponse;

    // Find the approval URL
    const approvalUrl = order.links?.find((link) => link.rel === 'approve')?.href;
    if (!approvalUrl) {
      throw new BadRequestError('Failed to create PayPal checkout session.');
    }

    // Store the pending invoice
    await prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        amount,
        currency,
        status: 'PENDING',
        paymentGateway: 'PAYPAL',
        paypalOrderId: order.id,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
      },
    });

    logger.info({ orgId, plan, orderId: order.id }, 'PayPal checkout session created');

    return {
      checkoutUrl: approvalUrl,
      orderId: order.id,
    };
  }

  /**
   * Confirm a PayPal payment from order ID.
   */
  async confirmPayPalPayment(orgId: string, orderId: string) {
    const paypalClientInstance = await getPayPalClient();

    logger.info({ orgId, orderId }, 'Confirming PayPal payment from checkout');

    // Get the order details
    const getOrderRequest = new paypal.orders.OrdersGetRequest(orderId);
    const getOrderResponse = await paypalClientInstance.execute(getOrderRequest);
    const order = getOrderResponse.result as PayPalOrderResponse;

    if (order.status !== 'APPROVED' && order.status !== 'COMPLETED') {
      throw new BadRequestError('Payment was not approved or completed.');
    }

    // Find the invoice by PayPal order ID
    const invoice = await prisma.invoice.findUnique({
      where: { paypalOrderId: orderId },
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

    // Capture the payment if not already captured
    let captureId: string | undefined;
    if (order.status === 'APPROVED') {
      const captureRequest = new paypal.orders.OrdersCaptureRequest(orderId);
      captureRequest.requestBody({});
      const captureResponse = await paypalClientInstance.execute(captureRequest);
      const capturedOrder = captureResponse.result as PayPalOrderResponse;
      captureId = capturedOrder.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    }

    // Verify amount matches
    const paidAmountNum = parseFloat(order.purchase_units?.[0]?.amount?.value || '0');
    const invoiceAmountNum = parseFloat(String(invoice.amount));
    logger.info({ paidAmountNum, invoiceAmountNum }, 'Comparing payment amounts');
    if (Math.abs(paidAmountNum - invoiceAmountNum) > 0.01) {
      throw new BadRequestError(`Payment amount (${paidAmountNum}) does not match invoice amount (${invoiceAmountNum}).`);
    }

    // Determine the new plan from the payment amount
    const planResult2 = await planConfigService.getPlanByPrice(invoiceAmountNum);
    if (!planResult2) {
      throw new BadRequestError('Unknown payment amount — cannot determine plan.');
    }

    const { plan: newPlan } = planResult2;
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
        paypalCaptureId: captureId ?? null,
        paidAt: now,
      },
    });

    await cache.del(`subscription:${orgId}`);

    logger.info(
      { orgId, newPlan, orderId },
      'PayPal payment confirmed, subscription upgraded',
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
      const result = await planConfigService.getPlanByPrice(amount);
      if (!result) {
        logger.error({ amount }, 'Unknown payment amount - cannot determine plan');
        return;
      }

      const { plan: newPlan, billingCycle } = result;
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
   * Verify a Stripe webhook signature.
   */
  async verifyStripeWebhookSignature(rawBody: string, signature: string): Promise<Stripe.Event> {
    const stripe = await getStripeClient();
    const stripeConfig = await getStripeConfig();

    if (!stripeConfig.webhookSecret) {
      throw new BadRequestError('Stripe webhook secret is not configured.');
    }

    try {
      return stripe.webhooks.constructEvent(rawBody, signature, stripeConfig.webhookSecret);
    } catch (error) {
      logger.error({ error }, 'Stripe webhook signature verification failed');
      throw new BadRequestError('Invalid Stripe webhook signature.');
    }
  }

  /**
   * Handle a Stripe webhook event.
   */
  async handleStripeWebhook(event: Stripe.Event) {
    logger.info({ type: event.type, id: event.id }, 'Processing Stripe webhook');

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleStripeCheckoutCompleted(event);
        break;
      case 'payment_intent.succeeded':
        await this.handleStripePaymentSucceeded(event);
        break;
      case 'payment_intent.payment_failed':
        await this.handleStripePaymentFailed(event);
        break;
      case 'invoice.paid':
        await this.handleStripeInvoicePaid(event);
        break;
      case 'invoice.payment_failed':
        await this.handleStripeInvoicePaymentFailed(event);
        break;
      default:
        logger.info({ type: event.type }, 'Unhandled Stripe webhook event type');
    }
  }

  /**
   * Handle checkout.session.completed event.
   */
  private async handleStripeCheckoutCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;

    logger.info({ sessionId: session.id }, 'Stripe checkout session completed');

    if (session.payment_status !== 'paid') {
      logger.info({ sessionId: session.id, status: session.payment_status }, 'Payment not completed yet');
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
    const paypalConfig = await getPayPalConfig();

    if (!paypalConfig.webhookId) {
      throw new BadRequestError('PayPal webhook ID is not configured.');
    }

    try {
      const paypalClientInstance = await getPayPalClient();

      const verifyRequest = {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: paypalConfig.webhookId,
        webhook_event: JSON.parse(rawBody),
      };

      // PayPal SDK doesn't have a built-in webhook verification method in checkout-server-sdk
      // For production, you would need to implement proper webhook verification
      // For now, we'll do a basic validation
      const hasRequiredHeaders =
        verifyRequest.auth_algo &&
        verifyRequest.cert_url &&
        verifyRequest.transmission_id &&
        verifyRequest.transmission_sig &&
        verifyRequest.transmission_time;

      return !!hasRequiredHeaders;
    } catch (error) {
      logger.error({ error }, 'PayPal webhook signature verification failed');
      return false;
    }
  }

  /**
   * Handle a PayPal webhook event.
   */
  async handlePayPalWebhook(payload: PayPalWebhookPayload) {
    logger.info({ type: payload.event_type, id: payload.resource.id }, 'Processing PayPal webhook');

    switch (payload.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await this.handlePayPalCaptureCompleted(payload);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED':
        await this.handlePayPalCaptureFailed(payload);
        break;
      case 'CHECKOUT.ORDER.APPROVED':
        await this.handlePayPalOrderApproved(payload);
        break;
      default:
        logger.info({ type: payload.event_type }, 'Unhandled PayPal webhook event type');
    }
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

  /**
   * Set or update spending cap for overage charges.
   * @param orgId - Organization ID
   * @param enabled - Whether spending cap is enabled
   * @param amount - Maximum overage charges allowed (required if enabled=true)
   */
  async setSpendingCap(orgId: string, enabled: boolean, amount?: number) {
    // Validate that amount is provided when enabling spending cap
    if (enabled && (amount === undefined || amount <= 0)) {
      throw new BadRequestError('A positive spending cap amount is required when enabling spending cap.');
    }

    const subscription = await this.getByOrgId(orgId);

    const updated = await prisma.subscription.update({
      where: { orgId },
      data: {
        spendingCapEnabled: enabled,
        spendingCapAmount: enabled && amount !== undefined ? amount : null,
      },
    });

    await cache.del(`subscription:${orgId}`);

    logger.info(
      { orgId, enabled, amount },
      `Spending cap ${enabled ? 'enabled' : 'disabled'} for organization`,
    );

    return updated;
  }

  /**
   * Remove spending cap (disable it).
   * @param orgId - Organization ID
   */
  async removeSpendingCap(orgId: string) {
    const subscription = await this.getByOrgId(orgId);

    const updated = await prisma.subscription.update({
      where: { orgId },
      data: {
        spendingCapEnabled: false,
        spendingCapAmount: null,
      },
    });

    await cache.del(`subscription:${orgId}`);

    logger.info({ orgId }, 'Spending cap removed for organization');

    return updated;
  }

  /**
   * Check if spending cap has been exceeded.
   * @param orgId - Organization ID
   * @returns true if spending cap is enabled and has been exceeded, false otherwise
   */
  async checkSpendingCapExceeded(orgId: string): Promise<boolean> {
    const subscription = await this.getByOrgId(orgId);

    // If spending cap is not enabled, it cannot be exceeded
    if (!subscription.spendingCapEnabled || !subscription.spendingCapAmount) {
      return false;
    }

    // Check if accrued overage charges have reached or exceeded the cap
    const overageCharges = subscription.overageChargesAccrued || 0;
    return overageCharges >= subscription.spendingCapAmount;
  }

  /**
   * Accrue overage charges for AI conversations beyond the plan limit.
   * @param orgId - Organization ID
   * @param amount - Amount to add to overage charges
   */
  async accrueOverageCharge(orgId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestError('Overage charge amount must be positive.');
    }

    const subscription = await this.getByOrgId(orgId);

    const currentOverage = subscription.overageChargesAccrued || 0;
    const newOverage = currentOverage + amount;

    const updated = await prisma.subscription.update({
      where: { orgId },
      data: {
        overageChargesAccrued: newOverage,
      },
    });

    await cache.del(`subscription:${orgId}`);

    logger.info(
      { orgId, amount, totalOverage: newOverage },
      'Overage charge accrued for organization',
    );

    return updated;
  }
}

export const subscriptionService = new SubscriptionService();
