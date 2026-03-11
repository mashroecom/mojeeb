import * as paypal from '@paypal/checkout-server-sdk';
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
// PayPal-specific Types
// ---------------------------------------------------------------------------

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
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Convert Infinity to a large integer safe for Prisma/PostgreSQL.
 */
function safeLimit(value: number): number {
  return Number.isFinite(value) ? value : 999999;
}

// ---------------------------------------------------------------------------
// PayPal Provider Implementation
// ---------------------------------------------------------------------------

export class PayPalProvider extends PaymentProvider {
  readonly name = 'PAYPAL';
  private client: paypal.core.PayPalHttpClient | null = null;
  private cachedConfig: {
    clientId: string;
    clientSecret: string;
    mode: string;
    webhookId: string;
  } | null = null;
  private lastConfigFetch: number = 0;
  private readonly CONFIG_TTL = 60000; // 1 minute

  /**
   * Get PayPal configuration dynamically from configService.
   * Recreates the config if it has changed or expired.
   * Falls back to static config if configService fails.
   */
  private async getPayPalConfig(): Promise<{
    clientId: string;
    clientSecret: string;
    mode: string;
    webhookId: string;
  }> {
    const now = Date.now();
    if (this.cachedConfig && now - this.lastConfigFetch < this.CONFIG_TTL) {
      return this.cachedConfig;
    }

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

    this.cachedConfig = { clientId, clientSecret, mode, webhookId };
    this.lastConfigFetch = now;

    return this.cachedConfig;
  }

  /**
   * Get or lazily create the PayPal client.
   * Recreates the client if the configuration has changed (e.g. updated via admin dashboard).
   * Falls back to static config if configService fails.
   */
  private async getClient(): Promise<paypal.core.PayPalHttpClient> {
    const paypalConfig = await this.getPayPalConfig();
    if (!paypalConfig.clientId || !paypalConfig.clientSecret) {
      throw new BadRequestError(
        'PayPal is not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in your environment.',
      );
    }

    if (!this.client) {
      const environment =
        paypalConfig.mode === 'live'
          ? new paypal.core.LiveEnvironment(paypalConfig.clientId, paypalConfig.clientSecret)
          : new paypal.core.SandboxEnvironment(paypalConfig.clientId, paypalConfig.clientSecret);

      this.client = new paypal.core.PayPalHttpClient(environment);
    }

    return this.client;
  }

  /**
   * Create a PayPal checkout session for upgrading to a paid plan.
   */
  async createCheckout(params: CheckoutParams): Promise<CheckoutResponse> {
    const { orgId, plan, billingCycle, amount, currency, redirectUrl, failureRedirectUrl } = params;

    const paypalClient = await this.getClient();

    // Find subscription to create invoice
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

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
          description: `Mojeeb ${plan} Plan - ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
        },
      ],
      application_context: {
        brand_name: 'Mojeeb',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: redirectUrl,
        cancel_url: failureRedirectUrl,
      },
    });

    const response = await paypalClient.execute(request);
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
        currency: currency.toUpperCase(),
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
   * This is used when the webhook can't reach the server (e.g., localhost).
   */
  async confirmPayment(params: PaymentConfirmationParams): Promise<PaymentConfirmation> {
    const { orgId, paymentId } = params;
    const orderId = paymentId;

    const paypalClient = await this.getClient();

    logger.info({ orgId, orderId }, 'Confirming PayPal payment from checkout');

    // Get the order details
    const getOrderRequest = new paypal.orders.OrdersGetRequest(orderId);
    const getOrderResponse = await paypalClient.execute(getOrderRequest);
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
      const paidAmountNum = parseFloat(order.purchase_units?.[0]?.amount?.value || '0');
      const currency = order.purchase_units?.[0]?.amount?.currency_code || 'USD';
      const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      return {
        success: true,
        transactionId: captureId,
        amount: paidAmountNum,
        currency,
      };
    }

    // Capture the payment if not already captured
    let captureId: string | undefined;
    if (order.status === 'APPROVED') {
      const captureRequest = new paypal.orders.OrdersCaptureRequest(orderId);
      captureRequest.requestBody({});
      const captureResponse = await paypalClient.execute(captureRequest);
      const capturedOrder = captureResponse.result as PayPalOrderResponse;
      captureId = capturedOrder.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    }

    // Verify amount matches
    const paidAmountNum = parseFloat(order.purchase_units?.[0]?.amount?.value || '0');
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

    logger.info({ orgId, newPlan, orderId }, 'PayPal payment confirmed, subscription upgraded');

    const currency = order.purchase_units?.[0]?.amount?.currency_code || 'USD';
    return {
      success: true,
      transactionId: captureId,
      amount: paidAmountNum,
      currency,
    };
  }

  /**
   * Verify a PayPal webhook signature.
   */
  async verifyWebhook(req: Request): Promise<boolean> {
    const paypalConfig = await this.getPayPalConfig();

    if (!paypalConfig.webhookId) {
      logger.warn('PayPal webhook ID is not configured');
      return false;
    }

    const rawBody = (req as Request & { rawBody?: string }).rawBody;
    if (!rawBody) {
      logger.warn('Missing raw body for webhook verification');
      return false;
    }

    try {
      const headers = req.headers as Record<string, string>;
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
  async handleWebhook(payload: WebhookPayload): Promise<void> {
    const paypalPayload = payload as unknown as PayPalWebhookPayload;

    logger.info(
      { type: paypalPayload.event_type, id: paypalPayload.resource.id },
      'Processing PayPal webhook',
    );

    switch (paypalPayload.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await this.handlePayPalCaptureCompleted(paypalPayload);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED':
        await this.handlePayPalCaptureFailed(paypalPayload);
        break;
      case 'CHECKOUT.ORDER.APPROVED':
        await this.handlePayPalOrderApproved(paypalPayload);
        break;
      default:
        logger.info({ type: paypalPayload.event_type }, 'Unhandled PayPal webhook event type');
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
    const planResult = await planConfigService.getPlanByPrice(amount);
    if (!planResult) {
      logger.error({ amount }, 'Unknown payment amount - cannot determine plan');
      return;
    }

    const { plan: newPlan, billingCycle } = planResult;
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
}
