import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { PaymentGateway } from '@mojeeb/shared-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GatewayPreferences {
  preferredGateway?: PaymentGateway;
  currency?: string;
}

export interface AvailableGateway {
  gateway: PaymentGateway;
  name: string;
  description: string;
  supportedCurrencies: string[];
  recommended: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * MENA region timezones that should default to Kashier
 */
const MENA_TIMEZONES = [
  'Asia/Riyadh',      // Saudi Arabia
  'Asia/Dubai',       // UAE
  'Africa/Cairo',     // Egypt
  'Asia/Kuwait',      // Kuwait
  'Asia/Qatar',       // Qatar
  'Asia/Bahrain',     // Bahrain
  'Asia/Muscat',      // Oman
  'Asia/Baghdad',     // Iraq
  'Asia/Amman',       // Jordan
  'Asia/Beirut',      // Lebanon
];

/**
 * Currency to gateway mapping
 * MENA currencies default to Kashier, international currencies to Stripe/PayPal
 */
const CURRENCY_GATEWAY_MAP: Record<string, PaymentGateway[]> = {
  'SAR': [PaymentGateway.KASHIER, PaymentGateway.STRIPE],
  'AED': [PaymentGateway.KASHIER, PaymentGateway.STRIPE],
  'EGP': [PaymentGateway.KASHIER, PaymentGateway.STRIPE],
  'USD': [PaymentGateway.STRIPE, PaymentGateway.PAYPAL],
  'EUR': [PaymentGateway.STRIPE, PaymentGateway.PAYPAL],
  'GBP': [PaymentGateway.STRIPE, PaymentGateway.PAYPAL],
};

/**
 * Default gateway based on region
 */
const DEFAULT_GATEWAY_MENA = PaymentGateway.KASHIER;
const DEFAULT_GATEWAY_INTERNATIONAL = PaymentGateway.STRIPE;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PaymentGatewayService {
  /**
   * Select the appropriate payment gateway for an organization.
   *
   * Selection logic:
   * 1. If preferredGateway is provided and valid, use it
   * 2. If currency is provided, select based on currency mapping
   * 3. Otherwise, select based on organization's timezone (MENA → Kashier, International → Stripe)
   *
   * @param orgId - Organization ID
   * @param preferences - Optional preferences including preferred gateway and currency
   * @returns Selected payment gateway
   */
  async selectGateway(
    orgId: string,
    preferences?: GatewayPreferences
  ): Promise<PaymentGateway> {
    // Fetch organization
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, timezone: true },
    });

    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    // 1. Check for explicit gateway preference
    if (preferences?.preferredGateway) {
      const isValid = this.isGatewayValid(preferences.preferredGateway);
      if (!isValid) {
        throw new BadRequestError(
          `Invalid payment gateway: ${preferences.preferredGateway}. Must be one of: KASHIER, STRIPE, PAYPAL`
        );
      }
      logger.info({
        message: 'Using preferred payment gateway',
        orgId,
        gateway: preferences.preferredGateway,
      });
      return preferences.preferredGateway;
    }

    // 2. Check for currency-based selection
    if (preferences?.currency) {
      const gateway = this.getGatewayForCurrency(preferences.currency);
      logger.info({
        message: 'Selected payment gateway based on currency',
        orgId,
        currency: preferences.currency,
        gateway,
      });
      return gateway;
    }

    // 3. Default to timezone-based selection
    const gateway = this.getGatewayForTimezone(org.timezone);
    logger.info({
      message: 'Selected payment gateway based on timezone',
      orgId,
      timezone: org.timezone,
      gateway,
    });
    return gateway;
  }

  /**
   * Get list of available payment gateways for an organization.
   *
   * @param orgId - Organization ID
   * @returns Array of available gateways with metadata
   */
  async getAvailableGateways(orgId: string): Promise<AvailableGateway[]> {
    // Fetch organization to determine default gateway
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, timezone: true },
    });

    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    const defaultGateway = this.getGatewayForTimezone(org.timezone);
    const isMenaRegion = MENA_TIMEZONES.includes(org.timezone);

    return [
      {
        gateway: PaymentGateway.KASHIER,
        name: 'Kashier',
        description: 'Optimized for MENA region with local payment methods',
        supportedCurrencies: ['SAR', 'AED', 'EGP', 'USD'],
        recommended: isMenaRegion,
      },
      {
        gateway: PaymentGateway.STRIPE,
        name: 'Stripe',
        description: 'International payment processing with credit cards and bank transfers',
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'SAR', 'AED'],
        recommended: !isMenaRegion,
      },
      {
        gateway: PaymentGateway.PAYPAL,
        name: 'PayPal',
        description: 'Global payment platform with PayPal balance and cards',
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        recommended: false,
      },
    ].sort((a, b) => {
      // Sort recommended gateways first, then by gateway name
      if (a.gateway === defaultGateway) return -1;
      if (b.gateway === defaultGateway) return 1;
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get the recommended payment gateway for a specific currency.
   *
   * @param currency - Currency code (e.g., 'USD', 'SAR', 'EUR')
   * @returns Recommended payment gateway for the currency
   */
  getGatewayForCurrency(currency: string): PaymentGateway {
    const upperCurrency = currency.toUpperCase();
    const gateways = CURRENCY_GATEWAY_MAP[upperCurrency];

    if (!gateways || gateways.length === 0) {
      // Default to Stripe for unknown currencies
      logger.warn({
        message: 'Unknown currency, defaulting to Stripe',
        currency,
      });
      return PaymentGateway.STRIPE;
    }

    // Return the first (recommended) gateway for this currency
    const gateway = gateways[0];
    if (!gateway) {
      return PaymentGateway.STRIPE;
    }
    return gateway;
  }

  /**
   * Get the default payment gateway based on organization's timezone.
   * MENA region timezones default to Kashier, others to Stripe.
   *
   * @param timezone - Organization's timezone
   * @returns Default payment gateway
   */
  private getGatewayForTimezone(timezone: string): PaymentGateway {
    if (MENA_TIMEZONES.includes(timezone)) {
      return DEFAULT_GATEWAY_MENA;
    }
    return DEFAULT_GATEWAY_INTERNATIONAL;
  }

  /**
   * Validate if a gateway value is a valid PaymentGateway enum.
   *
   * @param gateway - Gateway value to validate
   * @returns True if valid, false otherwise
   */
  private isGatewayValid(gateway: any): gateway is PaymentGateway {
    return Object.values(PaymentGateway).includes(gateway);
  }

  /**
   * Get supported currencies for a specific gateway.
   *
   * @param gateway - Payment gateway
   * @returns Array of supported currency codes
   */
  getSupportedCurrencies(gateway: PaymentGateway): string[] {
    switch (gateway) {
      case PaymentGateway.KASHIER:
        return ['SAR', 'AED', 'EGP', 'USD'];
      case PaymentGateway.STRIPE:
        return ['USD', 'EUR', 'GBP', 'SAR', 'AED'];
      case PaymentGateway.PAYPAL:
        return ['USD', 'EUR', 'GBP'];
      default:
        return [];
    }
  }

  /**
   * Check if a gateway supports a specific currency.
   *
   * @param gateway - Payment gateway
   * @param currency - Currency code
   * @returns True if supported, false otherwise
   */
  isCurrencySupported(gateway: PaymentGateway, currency: string): boolean {
    const supportedCurrencies = this.getSupportedCurrencies(gateway);
    return supportedCurrencies.includes(currency.toUpperCase());
  }
}

// Export singleton instance
export const paymentGatewayService = new PaymentGatewayService();
