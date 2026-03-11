import crypto from 'crypto';
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
// Kashier-specific Types
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
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Convert Infinity to a large integer safe for Prisma/PostgreSQL.
 */
function safeLimit(value: number): number {
  return Number.isFinite(value) ? value : 999999;
}

// ---------------------------------------------------------------------------
// Kashier Provider Implementation
// ---------------------------------------------------------------------------

export class KashierProvider extends PaymentProvider {
  readonly name = 'KASHIER';
  private cachedConfig: {
    merchantId: string;
    apiKey: string;
    webhookSecret: string;
  } | null = null;
  private lastConfigFetch: number = 0;
  private readonly CONFIG_TTL = 60000; // 1 minute

  /**
   * Get Kashier configuration dynamically from configService.
   * Recreates the config if it has changed or expired.
   * Falls back to static config if configService fails.
   */
  private async getKashierConfig(): Promise<{
    merchantId: string;
    apiKey: string;
    webhookSecret: string;
  }> {
    const now = Date.now();
    if (this.cachedConfig && now - this.lastConfigFetch < this.CONFIG_TTL) {
      return this.cachedConfig;
    }

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

    this.cachedConfig = { merchantId, apiKey, webhookSecret };
    this.lastConfigFetch = now;

    return this.cachedConfig;
  }

  /**
   * Create a Kashier checkout session for upgrading to a paid plan.
   */
  async createCheckout(params: CheckoutParams): Promise<CheckoutResponse> {
    const { orgId, plan, billingCycle, amount, currency, redirectUrl, failureRedirectUrl } = params;

    // Get dynamic Kashier config (falls back to static config)
    const kashier = await this.getKashierConfig();

    // If Kashier credentials are not configured, payment is not available
    if (!kashier.apiKey || !kashier.merchantId) {
      throw new BadRequestError(
        'Payment gateway is not configured. Please set KASHIER_API_KEY and KASHIER_MERCHANT_ID in your environment.',
      );
    }

    const merchantOrderId = `mojeeb_${orgId}_${Date.now()}`;

    // Generate Kashier payment hash
    // Path format: /?payment=mid.orderId.amount.currency
    // Hash = HMAC-SHA256(path, apiKey)
    const hashPath = `/?payment=${kashier.merchantId}.${merchantOrderId}.${amount}.${currency}`;
    const hash = crypto.createHmac('sha256', kashier.apiKey).update(hashPath).digest('hex');

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

    // Find subscription to create invoice
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

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
  async confirmPayment(params: PaymentConfirmationParams): Promise<PaymentConfirmation> {
    const { orgId, paymentId, additionalParams } = params;

    const merchantOrderId = paymentId;
    const paymentStatus = additionalParams?.paymentStatus as string;
    const transactionId = additionalParams?.transactionId as string | undefined;
    const amount = additionalParams?.amount as string;
    const currency = additionalParams?.currency as string;

    logger.info(
      { orgId, merchantOrderId, paymentStatus, amount },
      'Confirming payment from redirect',
    );

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
      return {
        success: true,
        transactionId,
        amount: parseFloat(amount),
        currency,
      };
    }

    // Verify amount matches (use parseFloat + String to handle Prisma Decimal safely)
    const paidAmountNum = parseFloat(amount);
    const invoiceAmountNum = parseFloat(String(invoice.amount));
    logger.info(
      {
        paidAmountNum,
        invoiceAmountNum,
        rawAmount: amount,
        rawInvoiceAmount: String(invoice.amount),
      },
      'Comparing payment amounts',
    );
    if (paidAmountNum !== invoiceAmountNum) {
      throw new BadRequestError(
        `Payment amount (${paidAmountNum}) does not match invoice amount (${invoiceAmountNum}).`,
      );
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

    return {
      success: true,
      transactionId,
      amount: paidAmountNum,
      currency,
    };
  }

  /**
   * Verify a Kashier webhook signature.
   */
  async verifyWebhook(req: Request): Promise<boolean> {
    const signature = req.headers['x-kashier-signature'] as string;
    if (!signature) {
      logger.warn('Missing Kashier webhook signature');
      return false;
    }

    const rawBody = (req as Request & { rawBody?: string }).rawBody;
    if (!rawBody) {
      logger.warn('Missing raw body for webhook verification');
      return false;
    }

    const kashier = await this.getKashierConfig();
    const expectedSignature = crypto
      .createHmac('sha256', kashier.webhookSecret)
      .update(rawBody)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch (error) {
      logger.error({ error }, 'Error verifying Kashier webhook signature');
      return false;
    }
  }

  /**
   * Handle a Kashier payment webhook event.
   */
  async handleWebhook(payload: WebhookPayload): Promise<void> {
    const kashierPayload = payload as unknown as KashierWebhookPayload;
    const { data } = kashierPayload;

    logger.info(
      { orderId: data.merchantOrderId, status: data.status, event: kashierPayload.event },
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
}
