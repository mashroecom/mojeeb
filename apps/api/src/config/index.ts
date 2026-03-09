import dotenv from 'dotenv';
import path from 'path';
import { logger } from './logger';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.API_PORT || '4000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://mojeeb:password@localhost:5432/mojeeb',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || '',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  },

  meta: {
    appSecret: process.env.META_APP_SECRET || '',
    verifyToken: process.env.META_VERIFY_TOKEN || '',
    whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    messengerPageAccessToken: process.env.MESSENGER_PAGE_ACCESS_TOKEN || '',
    instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
  },

  kashier: {
    merchantId: process.env.KASHIER_MERCHANT_ID || '',
    apiKey: process.env.KASHIER_API_KEY || '',
    webhookSecret: process.env.KASHIER_WEBHOOK_SECRET || '',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },

  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    mode: process.env.PAYPAL_MODE || 'sandbox',
    webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'noreply@mojeeb.app',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },
} as const;

export function validateConfig() {
  const isProd = config.nodeEnv === 'production';

  // Always validate critical secrets are set (not just in production)
  if (!config.jwt.secret) {
    if (isProd) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    logger.warn('JWT_SECRET is not set — set it in .env');
  }

  if (!config.encryption.key) {
    if (isProd) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    logger.warn('ENCRYPTION_KEY is not set — set it in .env');
  }

  if (isProd) {
    const required: [string, unknown][] = [
      ['DATABASE_URL', process.env.DATABASE_URL],
      ['JWT_SECRET', process.env.JWT_SECRET],
      ['ENCRYPTION_KEY', process.env.ENCRYPTION_KEY],
      ['REDIS_URL', process.env.REDIS_URL],
    ];
    const missing = required.filter(([, val]) => !val).map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate JWT secret strength
    if (config.jwt.secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    // Reject well-known placeholder JWT secrets
    const jwtPlaceholders = [
      'your-jwt-secret-change-in-production',
      'CHANGE_ME',
      'secret',
      'jwt-secret',
    ];
    if (jwtPlaceholders.some((p) => config.jwt.secret.toLowerCase().includes(p.toLowerCase()))) {
      throw new Error('JWT_SECRET contains a placeholder value. Set a strong random secret for production.');
    }

    // Validate encryption key length (must be 64 hex chars = 32 bytes)
    if (config.encryption.key.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }

    // Reject the example encryption key from .env.example
    if (config.encryption.key === '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') {
      throw new Error('ENCRYPTION_KEY is using the example value. Generate a random key: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }

    // Validate encryption key is valid hex
    if (!/^[0-9a-fA-F]{64}$/.test(config.encryption.key)) {
      throw new Error('ENCRYPTION_KEY must contain only hexadecimal characters (0-9, a-f)');
    }
  }
}
