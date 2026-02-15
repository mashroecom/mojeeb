export const APP_NAME = 'Mojeeb';

export const SUPPORTED_LOCALES = ['ar', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'ar';

export const AI_MODELS = {
  OPENAI: [
    { id: 'gpt-4o', name: 'GPT-4o', maxTokens: 4096 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', maxTokens: 4096 },
  ],
  ANTHROPIC: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', maxTokens: 4096 },
    { id: 'claude-haiku-4-20250514', name: 'Claude Haiku 4', maxTokens: 4096 },
  ],
} as const;

export const PLAN_PRICES = {
  FREE: { monthly: 0, yearly: 0 },
  STARTER: { monthly: 25, yearly: 250 },
  PROFESSIONAL: { monthly: 99, yearly: 990 },
  ENTERPRISE: { monthly: 0, yearly: 0 }, // Custom pricing
} as const;

export const EMOTION_COLORS: Record<string, string> = {
  happy: '#22c55e',
  satisfied: '#84cc16',
  neutral: '#6b7280',
  confused: '#f59e0b',
  frustrated: '#f97316',
  angry: '#ef4444',
  sad: '#3b82f6',
  urgent: '#a855f7',
};

export const CHANNEL_ICONS: Record<string, string> = {
  WHATSAPP: 'whatsapp',
  MESSENGER: 'messenger',
  INSTAGRAM: 'instagram',
  WEBCHAT: 'message-circle',
};
