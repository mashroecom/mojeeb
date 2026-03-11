import type { Request } from 'express';

// ---------------------------------------------------------------------------
// Shared Types
// ---------------------------------------------------------------------------

/**
 * Response from creating a checkout session.
 * Contains the URL to redirect the user to complete payment.
 */
export interface CheckoutResponse {
  /** URL where the user should be redirected to complete payment */
  checkoutUrl: string;
  /** Unique identifier for this checkout session/order */
  orderId: string;
}

/**
 * Payment confirmation result after successful payment.
 * Used to verify payment details and update subscription status.
 */
export interface PaymentConfirmation {
  /** Whether the payment was successful */
  success: boolean;
  /** Payment gateway's transaction ID (if available) */
  transactionId?: string;
  /** Amount charged in the smallest currency unit (e.g., cents) */
  amount: number;
  /** Currency code (e.g., USD, EUR) */
  currency: string;
}

/**
 * Generic webhook payload structure.
 * Each provider implements its own payload format.
 */
export interface WebhookPayload {
  /** Event type (e.g., 'payment.success', 'checkout.session.completed') */
  event: string;
  /** Provider-specific event data */
  data: Record<string, unknown>;
}

/**
 * Parameters for creating a checkout session.
 * Used to initiate the payment flow for a subscription.
 */
export interface CheckoutParams {
  /** Organization ID purchasing the subscription */
  orgId: string;
  /** Subscription plan name (e.g., 'STARTER', 'PROFESSIONAL') */
  plan: string;
  /** Billing frequency */
  billingCycle: 'monthly' | 'yearly';
  /** Amount to charge in the smallest currency unit (e.g., cents) */
  amount: number;
  /** Currency code (e.g., USD, EUR) */
  currency: string;
  /** URL to redirect user after successful payment */
  redirectUrl: string;
  /** URL to redirect user if payment fails or is cancelled */
  failureRedirectUrl: string;
}

/**
 * Parameters for confirming a payment.
 * Used to verify and process a completed payment.
 */
export interface PaymentConfirmationParams {
  /** Organization ID that made the payment */
  orgId: string;
  /** Payment/session ID to confirm */
  paymentId: string;
  /** Additional provider-specific parameters */
  additionalParams?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Abstract Base Class
// ---------------------------------------------------------------------------

/**
 * Abstract base class for payment provider implementations.
 *
 * This class defines the Strategy Pattern interface for payment processing.
 * Each payment provider (Kashier, Stripe, PayPal, etc.) implements these methods
 * with their provider-specific logic while maintaining a consistent API.
 *
 * @example
 * ```typescript
 * const provider = new KashierProvider();
 * const checkout = await provider.createCheckout({
 *   orgId: 'org_123',
 *   plan: 'PROFESSIONAL',
 *   billingCycle: 'monthly',
 *   amount: 2999,
 *   currency: 'USD',
 *   redirectUrl: 'https://example.com/success',
 *   failureRedirectUrl: 'https://example.com/failed'
 * });
 * ```
 */
export abstract class PaymentProvider {
  /** Provider name (e.g., 'Kashier', 'Stripe', 'PayPal') */
  abstract readonly name: string;

  /**
   * Create a checkout session for a subscription payment.
   *
   * Initiates the payment flow by creating a checkout session with the provider.
   * Returns a URL where the user should be redirected to complete the payment.
   *
   * @param params Checkout parameters including org, plan, amount, and redirect URLs
   * @returns Checkout response with URL and order ID
   * @throws {BadRequestError} If plan is invalid or price not configured
   * @throws {Error} If payment provider API call fails
   */
  abstract createCheckout(params: CheckoutParams): Promise<CheckoutResponse>;

  /**
   * Confirm a payment after user completes checkout.
   *
   * Verifies the payment was successful and processes the subscription upgrade.
   * This method should validate the payment status, verify the amount, update
   * the subscription record, and create an invoice.
   *
   * @param params Payment confirmation parameters
   * @returns Payment confirmation with transaction details
   * @throws {BadRequestError} If payment status is not successful or amount doesn't match
   * @throws {NotFoundError} If organization or invoice not found
   */
  abstract confirmPayment(params: PaymentConfirmationParams): Promise<PaymentConfirmation>;

  /**
   * Verify the signature of a webhook request.
   *
   * Validates that the webhook request came from the payment provider by
   * verifying the cryptographic signature. This prevents unauthorized
   * webhook events from being processed.
   *
   * @param req Express request object with webhook payload and headers
   * @returns True if signature is valid, false otherwise
   */
  abstract verifyWebhook(req: Request): Promise<boolean>;

  /**
   * Handle a webhook event from the payment provider.
   *
   * Processes asynchronous payment notifications from the provider.
   * Common events include successful payments, failed payments, and refunds.
   * This method should be idempotent as webhooks may be delivered multiple times.
   *
   * @param payload Webhook payload containing event type and data
   * @throws {NotFoundError} If referenced invoice or subscription not found
   */
  abstract handleWebhook(payload: WebhookPayload): Promise<void>;
}
