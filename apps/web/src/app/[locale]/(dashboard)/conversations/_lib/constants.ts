import {
  Bot,
  User,
  Headphones,
  Hash,
} from 'lucide-react';
import type { Conversation } from '@/hooks/useConversations';

export const API_SERVER_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
).replace(/\/api\/v1$/, '');

export function getMediaUrl(
  content: string,
  metadata?: { fileUrl?: string } | null,
): string {
  const url =
    content.startsWith('/uploads/') || content.startsWith('http')
      ? content
      : metadata?.fileUrl || content;
  if (url.startsWith('http')) return url;
  return `${API_SERVER_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function relativeTime(
  dateString: string | null,
  t: (key: any, values?: any) => string,
): string {
  if (!dateString) return '';
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return t('timeJustNow');
  if (diffMin < 60) return t('timeMinAgo', { count: diffMin });
  if (diffHours < 24) return t('timeHourAgo', { count: diffHours });
  return t('timeDayAgo', { count: diffDays });
}

export const STATUS_FILTER_MAP = {
  all: undefined,
  active: 'ACTIVE' as const,
  handoff: 'HANDED_OFF' as const,
  resolved: 'RESOLVED' as const,
};

export type StatusFilter = keyof typeof STATUS_FILTER_MAP;

export const EMOTION_COLORS: Record<string, string> = {
  happy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  satisfied: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  frustrated: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  angry: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  sad: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  confused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
};

export const EMOTION_EMOJI: Record<string, string> = {
  happy: '\u{1F60A}',
  satisfied: '\u{1F60C}',
  neutral: '\u{1F610}',
  frustrated: '\u{1F61F}',
  angry: '\u{1F620}',
  sad: '\u{1F622}',
  confused: '\u{1F615}',
};

export function emotionBadgeClass(emotion: string | null | undefined): string {
  if (!emotion)
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  return (
    EMOTION_COLORS[emotion.toLowerCase()] ??
    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  );
}

export function getEmotionEmoji(emotion: string | null | undefined): string {
  if (!emotion) return '';
  return EMOTION_EMOJI[emotion.toLowerCase()] ?? '';
}

export const EMOTION_TRANSLATION_KEY: Record<string, string> = {
  happy: 'emotionHappy',
  satisfied: 'emotionSatisfied',
  neutral: 'emotionNeutral',
  frustrated: 'emotionFrustrated',
  angry: 'emotionAngry',
  sad: 'emotionSad',
  confused: 'emotionConfused',
  urgent: 'emotionUrgent',
};

export const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  HANDED_OFF: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  WAITING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  RESOLVED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  ARCHIVED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

export const CHANNEL_BADGE: Record<string, string> = {
  whatsapp: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  messenger: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  instagram: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  web: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  webchat: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
};

export const CHANNEL_TRANSLATION_KEY: Record<string, string> = {
  webchat: 'channelWebchat',
  whatsapp: 'channelWhatsapp',
  messenger: 'channelMessenger',
  instagram: 'channelInstagram',
  web: 'channelWeb',
};

export const ROLE_ICON: Record<string, typeof Bot> = {
  AI_AGENT: Bot,
  CUSTOMER: User,
  HUMAN_AGENT: Headphones,
  SYSTEM: Hash,
};

export function getDisplayName(conv: Conversation, guestLabel: string): string {
  return conv.customerName || guestLabel;
}

export function getConversationSummary(conv: Conversation): string {
  if (conv.summary) return conv.summary;
  const lastMsg = conv.messages?.[0];
  if (lastMsg) {
    return lastMsg.content.length > 80
      ? lastMsg.content.slice(0, 80) + '...'
      : lastMsg.content;
  }
  return '';
}
