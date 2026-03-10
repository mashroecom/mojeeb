import type { Request } from 'express';

// ---------------------------------------------------------------------------
// Shared Types
// ---------------------------------------------------------------------------

export interface CheckoutResponse {
  checkoutUrl: string;
  orderId: string;
}

export interface PaymentConfirmation {
  success: boolean;
  transactionId?: string;
  amount: number;
  currency: string;
}

export interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
}

export interface CheckoutParams {
  orgId: string;
  plan: string;
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  redirectUrl: string;
  failureRedirectUrl: string;
}

export interface PaymentConfirmationParams {
  orgId: string;
  paymentId: string;
  additionalParams?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Abstract Base Class
// ---------------------------------------------------------------------------

export abstract class PaymentProvider {
  abstract readonly name: string;

  /**
   * Create a checkout session for a subscription payment.
   * @param params Checkout parameters including org, plan, amount, and redirect URLs
   * @returns Checkout response with URL and order ID
   */
  abstract createCheckout(params: CheckoutParams): Promise<CheckoutResponse>;

  /**
   * Confirm a payment after user completes checkout.
   * @param params Payment confirmation parameters
   * @returns Payment confirmation with transaction details
   */
  abstract confirmPayment(params: PaymentConfirmationParams): Promise<PaymentConfirmation>;

  /**
   * Verify the signature of a webhook request.
   * @param req Express request object with webhook payload
   * @returns True if signature is valid, false otherwise
   */
  abstract verifyWebhook(req: Request): Promise<boolean>;

  /**
   * Handle a webhook event from the payment provider.
   * @param payload Webhook payload
   */
  abstract handleWebhook(payload: WebhookPayload): Promise<void>;
}
