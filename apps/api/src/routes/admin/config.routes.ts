import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { configService } from '../../services/config.service';
import { auditLogService } from '../../services/auditLog.service';
import { validate } from '../../middleware/validate';
import { logger } from '../../config/logger';

const router: Router = Router();

const VALID_CATEGORIES = ['ai', 'payment', 'email', 'meta', 'oauth', 'general'] as const;

// Default config keys to seed if they don't exist
const CONFIG_DEFAULTS: Record<string, { category: string; label: string; description: string; isSecret: boolean }> = {
  // AI Providers
  OPENAI_API_KEY: { category: 'ai', label: 'OpenAI API Key', description: 'API key for OpenAI GPT models', isSecret: true },
  OPENAI_MODEL: { category: 'ai', label: 'OpenAI Model', description: 'Default OpenAI model (e.g. gpt-4o)', isSecret: false },
  ANTHROPIC_API_KEY: { category: 'ai', label: 'Anthropic API Key', description: 'API key for Anthropic Claude models', isSecret: true },
  // Payment
  KASHIER_MERCHANT_ID: { category: 'payment', label: 'Kashier Merchant ID', description: 'Merchant identifier for Kashier payment gateway', isSecret: false },
  KASHIER_API_KEY: { category: 'payment', label: 'Kashier API Key', description: 'API key for Kashier payment processing', isSecret: true },
  KASHIER_WEBHOOK_SECRET: { category: 'payment', label: 'Kashier Webhook Secret', description: 'Secret for verifying Kashier webhook signatures', isSecret: true },
  // Email
  RESEND_API_KEY: { category: 'email', label: 'Resend API Key', description: 'API key for Resend email service', isSecret: true },
  EMAIL_FROM: { category: 'email', label: 'From Address', description: 'Default sender email address (e.g. noreply@mojeeb.app)', isSecret: false },
  SALES_EMAIL: { category: 'email', label: 'Sales Email', description: 'Sales team email for contact forms', isSecret: false },
  SUPPORT_EMAIL: { category: 'email', label: 'Support Email', description: 'Support team email for help requests', isSecret: false },
  // Meta Platform
  META_APP_SECRET: { category: 'meta', label: 'Meta App Secret', description: 'App secret for Facebook/Meta platform', isSecret: true },
  META_VERIFY_TOKEN: { category: 'meta', label: 'Webhook Verify Token', description: 'Token for verifying Meta webhook subscriptions', isSecret: false },
  WHATSAPP_ACCESS_TOKEN: { category: 'meta', label: 'WhatsApp Access Token', description: 'Access token for WhatsApp Business API', isSecret: true },
  WHATSAPP_PHONE_NUMBER_ID: { category: 'meta', label: 'WhatsApp Phone Number ID', description: 'Phone number ID for WhatsApp Business', isSecret: false },
  MESSENGER_PAGE_ACCESS_TOKEN: { category: 'meta', label: 'Messenger Page Token', description: 'Page access token for Facebook Messenger', isSecret: true },
  // OAuth
  GOOGLE_CLIENT_ID: { category: 'oauth', label: 'Google Client ID', description: 'OAuth 2.0 Client ID for Google Sign-In', isSecret: false },
  GOOGLE_CLIENT_SECRET: { category: 'oauth', label: 'Google Client Secret', description: 'OAuth 2.0 Client Secret for Google Sign-In', isSecret: true },
  // General
  APP_URL: { category: 'general', label: 'Application URL', description: 'Public URL of the application (e.g. https://mojeeb.app)', isSecret: false },
  API_URL: { category: 'general', label: 'API URL', description: 'Public URL of the API server (e.g. https://api.mojeeb.app)', isSecret: false },
  JWT_SECRET: { category: 'general', label: 'JWT Secret', description: 'Secret key for signing JWT tokens (min 32 chars)', isSecret: true },
};

async function ensureConfigDefaults() {
  const existing = await prisma.systemConfig.findMany();
  const existingKeys = new Set(existing.map((c) => c.key));

  const toCreate = Object.entries(CONFIG_DEFAULTS)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, def]) => ({
      key,
      value: process.env[key] || '',
      category: def.category,
      label: def.label,
      description: def.description,
      isSecret: def.isSecret,
    }));

  if (toCreate.length > 0) {
    await prisma.systemConfig.createMany({ data: toCreate });
  }
}

// --- Schemas ---

const categoryParamSchema = z.object({
  category: z.enum(VALID_CATEGORIES),
});

const keyParamSchema = z.object({
  key: z.string().min(1),
});

const updateValueSchema = z.object({
  value: z.string(),
});

const testCategoryParamSchema = z.object({
  category: z.enum(VALID_CATEGORIES),
});

// --- GET / - List all configs grouped by category (secrets masked) ---
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureConfigDefaults();
    const configs = await prisma.systemConfig.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Group by category and mask secret values
    const grouped: Record<string, Array<{
      id: string;
      key: string;
      value: string;
      category: string;
      isSecret: boolean;
      label: string;
      description: string;
      updatedAt: Date;
    }>> = {};

    for (const cfg of configs) {
      if (!grouped[cfg.category]) {
        grouped[cfg.category] = [];
      }
      grouped[cfg.category]!.push({
        id: cfg.id,
        key: cfg.key,
        value: configService.maskValue(cfg.value, cfg.isSecret),
        category: cfg.category,
        isSecret: cfg.isSecret,
        label: cfg.label,
        description: cfg.description,
        updatedAt: cfg.updatedAt,
      });
    }

    res.json({ success: true, data: grouped });
  } catch (err) {
    next(err);
  }
});

// --- GET /:category - Get all configs for a specific category (secrets masked) ---
router.get(
  '/:category',
  validate({ params: categoryParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category } = req.params as { category: string };

      const configs = await configService.getByCategory(category as any);

      const masked = configs.map((cfg) => ({
        id: cfg.id,
        key: cfg.key,
        value: configService.maskValue(cfg.value, cfg.isSecret),
        category: cfg.category,
        isSecret: cfg.isSecret,
        label: cfg.label,
        description: cfg.description,
        updatedAt: cfg.updatedAt,
      }));

      res.json({ success: true, data: masked });
    } catch (err) {
      next(err);
    }
  }
);

// --- PATCH /:key - Update a single config value (audit logged) ---
router.patch(
  '/:key',
  validate({ params: keyParamSchema, body: updateValueSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = req.params.key as string;
      const { value } = req.body as { value: string };

      // Check if the config key exists
      const existing = await prisma.systemConfig.findUnique({ where: { key } });
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Config key not found' });
      }

      // Update the value
      await configService.set(key, value);

      // Clear cache so all subsequent reads get the new value
      configService.clearCache();

      // Audit log (don't log actual value for secrets)
      auditLogService.log({
        userId: req.user!.userId,
        action: 'CONFIG_UPDATED',
        targetType: 'SystemConfig',
        targetId: key,
        metadata: {
          key,
          category: existing.category,
          ...(existing.isSecret ? { value: '[REDACTED]' } : { value }),
        },
      }).catch(() => {});

      // Return the updated config with masked value
      const updated = await prisma.systemConfig.findUnique({ where: { key } });
      res.json({
        success: true,
        data: updated
          ? {
              id: updated.id,
              key: updated.key,
              value: configService.maskValue(updated.value, updated.isSecret),
              category: updated.category,
              isSecret: updated.isSecret,
              label: updated.label,
              description: updated.description,
              updatedAt: updated.updatedAt,
            }
          : null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// --- POST /test/:category - Test connectivity for a category ---
router.post(
  '/test/:category',
  validate({ params: testCategoryParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category } = req.params as { category: string };

      const result = await testCategory(category);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// --- Category connectivity test helpers ---

interface TestResult {
  key: string;
  label: string;
  success: boolean;
  message: string;
}

interface CategoryTestResult {
  success: boolean;
  message: string;
  results: TestResult[];
}

async function testCategory(category: string): Promise<CategoryTestResult> {
  switch (category) {
    case 'ai':
      return testAi();
    case 'email':
      return testEmail();
    case 'payment':
      return testPayment();
    case 'meta':
      return testMeta();
    case 'oauth':
      return testOAuth();
    case 'general':
      return testGeneral();
    default:
      return { success: true, message: 'No connectivity test available for this category', results: [] };
  }
}

async function testAi(): Promise<CategoryTestResult> {
  const results: TestResult[] = [];

  // Test OpenAI
  try {
    const openaiKey = await configService.get('OPENAI_API_KEY');
    if (!openaiKey) {
      results.push({ key: 'OPENAI_API_KEY', label: 'OpenAI API Key', success: false, message: 'Not configured' });
    } else {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${openaiKey}` },
      });
      if (response.ok) {
        results.push({ key: 'OPENAI_API_KEY', label: 'OpenAI API Key', success: true, message: 'Valid - connected successfully' });
      } else {
        results.push({ key: 'OPENAI_API_KEY', label: 'OpenAI API Key', success: false, message: `Invalid (status ${response.status})` });
      }
    }
  } catch (err) {
    results.push({ key: 'OPENAI_API_KEY', label: 'OpenAI API Key', success: false, message: `Connection failed: ${(err as Error).message}` });
  }

  // Test Anthropic
  try {
    const anthropicKey = await configService.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      results.push({ key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', success: false, message: 'Not configured' });
    } else {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      if (response.status === 401) {
        results.push({ key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', success: false, message: 'Invalid API key' });
      } else {
        results.push({ key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', success: true, message: 'Valid - connected successfully' });
      }
    }
  } catch (err) {
    results.push({ key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', success: false, message: `Connection failed: ${(err as Error).message}` });
  }

  const allSuccess = results.every((r) => r.success);
  const anySuccess = results.some((r) => r.success);
  return {
    success: anySuccess,
    message: allSuccess ? 'All AI providers are valid' : anySuccess ? 'Some AI providers need attention' : 'No AI providers configured',
    results,
  };
}

async function testEmail(): Promise<CategoryTestResult> {
  const results: TestResult[] = [];

  // Test Resend API Key
  try {
    const resendKey = await configService.get('RESEND_API_KEY');
    if (!resendKey) {
      results.push({ key: 'RESEND_API_KEY', label: 'Resend API Key', success: false, message: 'Not configured' });
    } else {
      const response = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: { Authorization: `Bearer ${resendKey}` },
      });
      if (response.ok) {
        results.push({ key: 'RESEND_API_KEY', label: 'Resend API Key', success: true, message: 'Valid - connected successfully' });
      } else {
        results.push({ key: 'RESEND_API_KEY', label: 'Resend API Key', success: false, message: `Invalid (status ${response.status})` });
      }
    }
  } catch (err) {
    results.push({ key: 'RESEND_API_KEY', label: 'Resend API Key', success: false, message: `Connection failed: ${(err as Error).message}` });
  }

  // Check From Address
  const emailFrom = await configService.get('EMAIL_FROM');
  results.push({
    key: 'EMAIL_FROM',
    label: 'From Address',
    success: !!emailFrom,
    message: emailFrom ? `Set to: ${emailFrom}` : 'Not configured',
  });

  return {
    success: results.every((r) => r.success),
    message: results.every((r) => r.success) ? 'Email configuration is valid' : 'Some email settings need attention',
    results,
  };
}

async function testPayment(): Promise<CategoryTestResult> {
  const results: TestResult[] = [];

  const merchantId = await configService.get('KASHIER_MERCHANT_ID');
  results.push({
    key: 'KASHIER_MERCHANT_ID',
    label: 'Kashier Merchant ID',
    success: !!merchantId && merchantId.length >= 3,
    message: !merchantId ? 'Not configured' : merchantId.length < 3 ? 'Too short (min 3 chars)' : 'Format valid',
  });

  const apiKey = await configService.get('KASHIER_API_KEY');
  results.push({
    key: 'KASHIER_API_KEY',
    label: 'Kashier API Key',
    success: !!apiKey && apiKey.length >= 10,
    message: !apiKey ? 'Not configured' : apiKey.length < 10 ? 'Too short (min 10 chars)' : 'Format valid',
  });

  const webhookSecret = await configService.get('KASHIER_WEBHOOK_SECRET');
  results.push({
    key: 'KASHIER_WEBHOOK_SECRET',
    label: 'Kashier Webhook Secret',
    success: !!webhookSecret,
    message: webhookSecret ? 'Configured' : 'Not configured',
  });

  return {
    success: results.every((r) => r.success),
    message: results.every((r) => r.success) ? 'Payment credentials are valid' : 'Some payment settings need attention',
    results,
  };
}

async function testMeta(): Promise<CategoryTestResult> {
  const results: TestResult[] = [];

  const appSecret = await configService.get('META_APP_SECRET');
  results.push({
    key: 'META_APP_SECRET',
    label: 'Meta App Secret',
    success: !!appSecret,
    message: appSecret ? 'Configured' : 'Not configured',
  });

  const verifyToken = await configService.get('META_VERIFY_TOKEN');
  results.push({
    key: 'META_VERIFY_TOKEN',
    label: 'Webhook Verify Token',
    success: !!verifyToken,
    message: verifyToken ? 'Configured' : 'Not configured',
  });

  // Test WhatsApp token
  try {
    const whatsappToken = await configService.get('WHATSAPP_ACCESS_TOKEN');
    if (!whatsappToken) {
      results.push({ key: 'WHATSAPP_ACCESS_TOKEN', label: 'WhatsApp Access Token', success: false, message: 'Not configured' });
    } else {
      const phoneId = await configService.get('WHATSAPP_PHONE_NUMBER_ID');
      if (phoneId) {
        const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}`, {
          headers: { Authorization: `Bearer ${whatsappToken}` },
        });
        results.push({
          key: 'WHATSAPP_ACCESS_TOKEN',
          label: 'WhatsApp Access Token',
          success: response.ok,
          message: response.ok ? 'Valid - connected successfully' : `Invalid (status ${response.status})`,
        });
      } else {
        results.push({ key: 'WHATSAPP_ACCESS_TOKEN', label: 'WhatsApp Access Token', success: false, message: 'Phone Number ID needed to test' });
      }
    }
  } catch (err) {
    results.push({ key: 'WHATSAPP_ACCESS_TOKEN', label: 'WhatsApp Access Token', success: false, message: `Connection failed: ${(err as Error).message}` });
  }

  const phoneId = await configService.get('WHATSAPP_PHONE_NUMBER_ID');
  results.push({
    key: 'WHATSAPP_PHONE_NUMBER_ID',
    label: 'WhatsApp Phone Number ID',
    success: !!phoneId,
    message: phoneId ? 'Configured' : 'Not configured',
  });

  // Test Messenger token
  try {
    const messengerToken = await configService.get('MESSENGER_PAGE_ACCESS_TOKEN');
    if (!messengerToken) {
      results.push({ key: 'MESSENGER_PAGE_ACCESS_TOKEN', label: 'Messenger Page Token', success: false, message: 'Not configured' });
    } else {
      const response = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${messengerToken}`);
      results.push({
        key: 'MESSENGER_PAGE_ACCESS_TOKEN',
        label: 'Messenger Page Token',
        success: response.ok,
        message: response.ok ? 'Valid - connected successfully' : `Invalid (status ${response.status})`,
      });
    }
  } catch (err) {
    results.push({ key: 'MESSENGER_PAGE_ACCESS_TOKEN', label: 'Messenger Page Token', success: false, message: `Connection failed: ${(err as Error).message}` });
  }

  const anySuccess = results.some((r) => r.success);
  return {
    success: results.every((r) => r.success),
    message: results.every((r) => r.success) ? 'All Meta integrations are valid' : anySuccess ? 'Some Meta tokens need attention' : 'No Meta tokens configured',
    results,
  };
}

async function testOAuth(): Promise<CategoryTestResult> {
  const results: TestResult[] = [];

  const clientId = await configService.get('GOOGLE_CLIENT_ID');
  const googleClientIdPattern = /^\d+-[a-zA-Z0-9_]+\.apps\.googleusercontent\.com$/;
  results.push({
    key: 'GOOGLE_CLIENT_ID',
    label: 'Google Client ID',
    success: !!clientId && googleClientIdPattern.test(clientId),
    message: !clientId ? 'Not configured' : googleClientIdPattern.test(clientId) ? 'Format valid' : 'Invalid format (expected *.apps.googleusercontent.com)',
  });

  const clientSecret = await configService.get('GOOGLE_CLIENT_SECRET');
  results.push({
    key: 'GOOGLE_CLIENT_SECRET',
    label: 'Google Client Secret',
    success: !!clientSecret && clientSecret.length >= 10,
    message: !clientSecret ? 'Not configured' : clientSecret.length >= 10 ? 'Configured' : 'Too short',
  });

  return {
    success: results.every((r) => r.success),
    message: results.every((r) => r.success) ? 'OAuth credentials are valid' : 'Some OAuth settings need attention',
    results,
  };
}

async function testGeneral(): Promise<CategoryTestResult> {
  const results: TestResult[] = [];

  const appUrl = await configService.get('APP_URL');
  results.push({
    key: 'APP_URL',
    label: 'Application URL',
    success: !!appUrl,
    message: appUrl ? `Set to: ${appUrl}` : 'Not configured',
  });

  const apiUrl = await configService.get('API_URL');
  results.push({
    key: 'API_URL',
    label: 'API URL',
    success: !!apiUrl,
    message: apiUrl ? `Set to: ${apiUrl}` : 'Not configured',
  });

  const jwtSecret = await configService.get('JWT_SECRET');
  results.push({
    key: 'JWT_SECRET',
    label: 'JWT Secret',
    success: !!jwtSecret && jwtSecret.length >= 32,
    message: !jwtSecret ? 'Not configured' : jwtSecret.length < 32 ? `Too short (${jwtSecret.length} chars, min 32)` : 'Configured (secure length)',
  });

  return {
    success: results.every((r) => r.success),
    message: results.every((r) => r.success) ? 'General settings are valid' : 'Some general settings need attention',
    results,
  };
}

export default router;
