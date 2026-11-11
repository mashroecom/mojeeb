import type { CustomerChannel, CustomerConversationStatus } from '@/hooks/useCustomers';

/** Translation keys under `dashboard.customers` for each channel type. */
export const CHANNEL_LABEL_KEY: Record<CustomerChannel, string> = {
  WEBCHAT: 'channel_webchat',
  WHATSAPP: 'channel_whatsapp',
  MESSENGER: 'channel_messenger',
  INSTAGRAM: 'channel_instagram',
};

export const CHANNEL_BADGE_CLASS: Record<CustomerChannel, string> = {
  WEBCHAT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  WHATSAPP: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  MESSENGER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  INSTAGRAM: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
};

/** Translation keys under `dashboard.customers` for each conversation status. */
export const STATUS_LABEL_KEY: Record<CustomerConversationStatus, string> = {
  ACTIVE: 'status_open',
  WAITING: 'status_pending',
  HANDED_OFF: 'status_handed_off',
  RESOLVED: 'status_resolved',
  ARCHIVED: 'status_closed',
};

export const STATUS_BADGE_VARIANT: Record<
  CustomerConversationStatus,
  'success' | 'warning' | 'info' | 'neutral' | 'primary'
> = {
  ACTIVE: 'info',
  WAITING: 'warning',
  HANDED_OFF: 'primary',
  RESOLVED: 'success',
  ARCHIVED: 'neutral',
};

const KNOWN_EMOTIONS = new Set([
  'happy',
  'satisfied',
  'neutral',
  'confused',
  'frustrated',
  'angry',
  'sad',
  'urgent',
]);

/** Translation key for an emotion value, or null when the value is unknown/empty. */
export function emotionLabelKey(emotion: string | null | undefined): string | null {
  const value = emotion?.toLowerCase();
  return value && KNOWN_EMOTIONS.has(value) ? `emotion_${value}` : null;
}

const EMOTION_BADGE_CLASS: Record<string, string> = {
  happy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  satisfied: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  confused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  frustrated: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  angry: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  sad: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function emotionBadgeClass(emotion: string | null | undefined): string {
  return EMOTION_BADGE_CLASS[emotion?.toLowerCase() ?? ''] ?? EMOTION_BADGE_CLASS.neutral;
}

/** First letter for the avatar circle. */
export function initialOf(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? Array.from(trimmed)[0].toUpperCase() : '?';
}
