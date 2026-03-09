import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentGateway } from '@mojeeb/shared-types';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the service
// ---------------------------------------------------------------------------

vi.mock('../config/database', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { PaymentGatewayService } from './paymentGateway.service';
import { prisma } from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';

describe('PaymentGatewayService', () => {
  let service: PaymentGatewayService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentGatewayService();
  });

  // -----------------------------------------------------------------------
  // selectGateway - Timezone-based selection
  // -----------------------------------------------------------------------
  describe('selectGateway - timezone-based selection', () => {
    it('should default to Kashier for Saudi Arabia (Asia/Riyadh)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-sa',
        timezone: 'Asia/Riyadh',
      } as any);

      const gateway = await service.selectGateway('org-sa');

      expect(gateway).toBe(PaymentGateway.KASHIER);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-sa' },
        select: { id: true, timezone: true },
      });
    });

    it('should default to Kashier for UAE (Asia/Dubai)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-ae',
        timezone: 'Asia/Dubai',
      } as any);

      const gateway = await service.selectGateway('org-ae');

      expect(gateway).toBe(PaymentGateway.KASHIER);
    });

    it('should default to Kashier for Egypt (Africa/Cairo)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-eg',
        timezone: 'Africa/Cairo',
      } as any);

      const gateway = await service.selectGateway('org-eg');

      expect(gateway).toBe(PaymentGateway.KASHIER);
    });

    it('should default to Kashier for Kuwait (Asia/Kuwait)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-kw',
        timezone: 'Asia/Kuwait',
      } as any);

      const gateway = await service.selectGateway('org-kw');

      expect(gateway).toBe(PaymentGateway.KASHIER);
    });

    it('should default to Kashier for Qatar (Asia/Qatar)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-qa',
        timezone: 'Asia/Qatar',
      } as any);

      const gateway = await service.selectGateway('org-qa');

      expect(gateway).toBe(PaymentGateway.KASHIER);
    });

    it('should default to Kashier for Bahrain (Asia/Bahrain)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-bh',
        timezone: 'Asia/Bahrain',
      } as any);

      const gateway = await service.selectGateway('org-bh');

      expect(gateway).toBe(PaymentGateway.KASHIER);
    });

    it('should default to Stripe for US (America/New_York)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-us',
        timezone: 'America/New_York',
      } as any);

      const gateway = await service.selectGateway('org-us');

      expect(gateway).toBe(PaymentGateway.STRIPE);
    });

    it('should default to Stripe for US (America/Los_Angeles)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-us-west',
        timezone: 'America/Los_Angeles',
      } as any);

      const gateway = await service.selectGateway('org-us-west');

      expect(gateway).toBe(PaymentGateway.STRIPE);
    });

    it('should default to Stripe for UK (Europe/London)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-uk',
        timezone: 'Europe/London',
      } as any);

      const gateway = await service.selectGateway('org-uk');

      expect(gateway).toBe(PaymentGateway.STRIPE);
    });

    it('should default to Stripe for Germany (Europe/Berlin)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-de',
        timezone: 'Europe/Berlin',
      } as any);

      const gateway = await service.selectGateway('org-de');

      expect(gateway).toBe(PaymentGateway.STRIPE);
    });

    it('should default to Stripe for France (Europe/Paris)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-fr',
        timezone: 'Europe/Paris',
      } as any);

      const gateway = await service.selectGateway('org-fr');

      expect(gateway).toBe(PaymentGateway.STRIPE);
    });

    it('should throw NotFoundError when organization does not exist', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      await expect(service.selectGateway('org-missing')).rejects.toThrow(
        'Organization not found',
      );
    });
  });

  // -----------------------------------------------------------------------
  // selectGateway - Manual gateway override
  // -----------------------------------------------------------------------
  describe('selectGateway - manual gateway override', () => {
    it('should use preferred gateway (STRIPE) regardless of timezone', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-sa',
        timezone: 'Asia/Riyadh', // MENA timezone (would default to Kashier)
      } as any);

      const gateway = await service.selectGateway('org-sa', {
        preferredGateway: PaymentGateway.STRIPE,
      });

      expect(gateway).toBe(PaymentGateway.STRIPE);
    });

    it('should use preferred gateway (PAYPAL) regardless of timezone', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-us',
        timezone: 'America/New_York', // International timezone
      } as any);

      const gateway = await service.selectGateway('org-us', {
        preferredGateway: PaymentGateway.PAYPAL,
      });

      expect(gateway).toBe(PaymentGateway.PAYPAL);
    });

    it('should use preferred gateway (KASHIER) for international org', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-uk',
        timezone: 'Europe/London', // Would default to Stripe
      } as any);

      const gateway = await service.selectGateway('org-uk', {
        preferredGateway: PaymentGateway.KASHIER,
      });

      expect(gateway).toBe(PaymentGateway.KASHIER);
    });

    it('should throw BadRequestError for invalid gateway', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-sa',
        timezone: 'Asia/Riyadh',
      } as any);

      await expect(
        service.selectGateway('org-sa', {
          preferredGateway: 'INVALID' as any,
        }),
      ).rejects.toThrow('Invalid payment gateway');
    });
  });

  // -----------------------------------------------------------------------
  // selectGateway - Currency-based selection
  // -----------------------------------------------------------------------
  describe('selectGateway - currency-based selection', () => {
    it('should select Kashier for SAR (Saudi Riyal)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-1',
        timezone: 'America/New_York', // Even for US timezone
      } as any);

      const gateway = await service.selectGateway('org-1', {
        currency: 'SAR',
      });

      expect(gateway).toBe(PaymentGateway.KASHIER);
    });

    it('should select Kashier for AED (UAE Dirham)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-1',
        timezone: 'Europe/London',
      } as any);

      const gateway = await service.selectGateway('org-1', {
        currency: 'AED',
      });

      expect(gateway).toBe(PaymentGateway.KASHIER);
    });

    it('should select Kashier for EGP (Egyptian Pound)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-1',
        timezone: 'America/Los_Angeles',
      } as any);

      const gateway = await service.selectGateway('org-1', {
        currency: 'EGP',
      });

      expect(gateway).toBe(PaymentGateway.KASHIER);
    });

    it('should select Stripe for USD (US Dollar)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-1',
        timezone: 'Asia/Riyadh', // Even for MENA timezone
      } as any);

      const gateway = await service.selectGateway('org-1', {
        currency: 'USD',
      });

      expect(gateway).toBe(PaymentGateway.STRIPE);
    });

    it('should select Stripe for EUR (Euro)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-1',
        timezone: 'Africa/Cairo',
      } as any);

      const gateway = await service.selectGateway('org-1', {
        currency: 'EUR',
      });

      expect(gateway).toBe(PaymentGateway.STRIPE);
    });

    it('should select Stripe for GBP (British Pound)', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-1',
        timezone: 'Asia/Dubai',
      } as any);

      const gateway = await service.selectGateway('org-1', {
        currency: 'GBP',
      });

      expect(gateway).toBe(PaymentGateway.STRIPE);
    });

    it('should handle lowercase currency codes', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-1',
        timezone: 'America/New_York',
      } as any);

      const gateway = await service.selectGateway('org-1', {
        currency: 'sar',
      });

      expect(gateway).toBe(PaymentGateway.KASHIER);
    });

    it('should default to Stripe for unknown currency', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-1',
        timezone: 'Asia/Tokyo',
      } as any);

      const gateway = await service.selectGateway('org-1', {
        currency: 'JPY', // Unsupported currency
      });

      expect(gateway).toBe(PaymentGateway.STRIPE);
    });
  });

  // -----------------------------------------------------------------------
  // selectGateway - Priority order
  // -----------------------------------------------------------------------
  describe('selectGateway - priority order', () => {
    it('should prioritize preferredGateway over currency', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-1',
        timezone: 'America/New_York',
      } as any);

      const gateway = await service.selectGateway('org-1', {
        preferredGateway: PaymentGateway.PAYPAL,
        currency: 'SAR', // Would select Kashier
      });

      expect(gateway).toBe(PaymentGateway.PAYPAL);
    });

    it('should prioritize currency over timezone', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-1',
        timezone: 'Asia/Riyadh', // Would select Kashier
      } as any);

      const gateway = await service.selectGateway('org-1', {
        currency: 'USD', // Should select Stripe
      });

      expect(gateway).toBe(PaymentGateway.STRIPE);
    });
  });

  // -----------------------------------------------------------------------
  // getAvailableGateways
  // -----------------------------------------------------------------------
  describe('getAvailableGateways', () => {
    it('should mark Kashier as recommended for MENA region', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-sa',
        timezone: 'Asia/Riyadh',
      } as any);

      const gateways = await service.getAvailableGateways('org-sa');

      expect(gateways).toHaveLength(3);

      const kashier = gateways.find(g => g.gateway === PaymentGateway.KASHIER);
      expect(kashier?.recommended).toBe(true);

      const stripe = gateways.find(g => g.gateway === PaymentGateway.STRIPE);
      expect(stripe?.recommended).toBe(false);

      const paypal = gateways.find(g => g.gateway === PaymentGateway.PAYPAL);
      expect(paypal?.recommended).toBe(false);
    });

    it('should mark Stripe as recommended for international region', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-us',
        timezone: 'America/New_York',
      } as any);

      const gateways = await service.getAvailableGateways('org-us');

      expect(gateways).toHaveLength(3);

      const kashier = gateways.find(g => g.gateway === PaymentGateway.KASHIER);
      expect(kashier?.recommended).toBe(false);

      const stripe = gateways.find(g => g.gateway === PaymentGateway.STRIPE);
      expect(stripe?.recommended).toBe(true);

      const paypal = gateways.find(g => g.gateway === PaymentGateway.PAYPAL);
      expect(paypal?.recommended).toBe(false);
    });

    it('should sort recommended gateway first', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-sa',
        timezone: 'Asia/Riyadh',
      } as any);

      const gateways = await service.getAvailableGateways('org-sa');

      // First gateway should be the recommended one (Kashier for MENA)
      expect(gateways[0]).toBeDefined();
      expect(gateways[0]?.gateway).toBe(PaymentGateway.KASHIER);
      expect(gateways[0]?.recommended).toBe(true);
    });

    it('should throw NotFoundError when organization does not exist', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      await expect(service.getAvailableGateways('org-missing')).rejects.toThrow(
        'Organization not found',
      );
    });
  });

  // -----------------------------------------------------------------------
  // getGatewayForCurrency
  // -----------------------------------------------------------------------
  describe('getGatewayForCurrency', () => {
    it('should return Kashier for SAR', () => {
      const gateway = service.getGatewayForCurrency('SAR');
      expect(gateway).toBe(PaymentGateway.KASHIER);
    });

    it('should return Kashier for AED', () => {
      const gateway = service.getGatewayForCurrency('AED');
      expect(gateway).toBe(PaymentGateway.KASHIER);
    });

    it('should return Kashier for EGP', () => {
      const gateway = service.getGatewayForCurrency('EGP');
      expect(gateway).toBe(PaymentGateway.KASHIER);
    });

    it('should return Stripe for USD', () => {
      const gateway = service.getGatewayForCurrency('USD');
      expect(gateway).toBe(PaymentGateway.STRIPE);
    });

    it('should return Stripe for EUR', () => {
      const gateway = service.getGatewayForCurrency('EUR');
      expect(gateway).toBe(PaymentGateway.STRIPE);
    });

    it('should return Stripe for GBP', () => {
      const gateway = service.getGatewayForCurrency('GBP');
      expect(gateway).toBe(PaymentGateway.STRIPE);
    });

    it('should default to Stripe for unknown currency', () => {
      const gateway = service.getGatewayForCurrency('JPY');
      expect(gateway).toBe(PaymentGateway.STRIPE);
    });
  });

  // -----------------------------------------------------------------------
  // getSupportedCurrencies
  // -----------------------------------------------------------------------
  describe('getSupportedCurrencies', () => {
    it('should return correct currencies for Kashier', () => {
      const currencies = service.getSupportedCurrencies(PaymentGateway.KASHIER);
      expect(currencies).toEqual(['SAR', 'AED', 'EGP', 'USD']);
    });

    it('should return correct currencies for Stripe', () => {
      const currencies = service.getSupportedCurrencies(PaymentGateway.STRIPE);
      expect(currencies).toEqual(['USD', 'EUR', 'GBP', 'SAR', 'AED']);
    });

    it('should return correct currencies for PayPal', () => {
      const currencies = service.getSupportedCurrencies(PaymentGateway.PAYPAL);
      expect(currencies).toEqual(['USD', 'EUR', 'GBP']);
    });
  });

  // -----------------------------------------------------------------------
  // isCurrencySupported
  // -----------------------------------------------------------------------
  describe('isCurrencySupported', () => {
    it('should return true for SAR with Kashier', () => {
      const supported = service.isCurrencySupported(PaymentGateway.KASHIER, 'SAR');
      expect(supported).toBe(true);
    });

    it('should return false for EUR with Kashier', () => {
      const supported = service.isCurrencySupported(PaymentGateway.KASHIER, 'EUR');
      expect(supported).toBe(false);
    });

    it('should return true for USD with Stripe', () => {
      const supported = service.isCurrencySupported(PaymentGateway.STRIPE, 'USD');
      expect(supported).toBe(true);
    });

    it('should return true for EUR with Stripe', () => {
      const supported = service.isCurrencySupported(PaymentGateway.STRIPE, 'EUR');
      expect(supported).toBe(true);
    });

    it('should return false for EGP with PayPal', () => {
      const supported = service.isCurrencySupported(PaymentGateway.PAYPAL, 'EGP');
      expect(supported).toBe(false);
    });

    it('should return true for USD with PayPal', () => {
      const supported = service.isCurrencySupported(PaymentGateway.PAYPAL, 'USD');
      expect(supported).toBe(true);
    });

    it('should handle lowercase currency codes', () => {
      const supported = service.isCurrencySupported(PaymentGateway.KASHIER, 'sar');
      expect(supported).toBe(true);
    });
  });
});
