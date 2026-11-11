'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { CustomerChannel } from '@/hooks/useCustomers';
import {
  CHANNEL_BADGE_CLASS,
  CHANNEL_LABEL_KEY,
  emotionBadgeClass,
  emotionLabelKey,
} from '../_lib/display';

const badgeBase = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';

export function ChannelBadge({ channel }: { channel: CustomerChannel }) {
  const t = useTranslations('dashboard.customers');
  return (
    <span className={cn(badgeBase, CHANNEL_BADGE_CLASS[channel])}>
      {t(CHANNEL_LABEL_KEY[channel])}
    </span>
  );
}

/** Sentiment badge; renders an em dash when no emotion has been detected. */
export function EmotionBadge({ emotion }: { emotion: string | null }) {
  const t = useTranslations('dashboard.customers');
  if (!emotion) return <span className="text-sm text-muted-foreground">{'—'}</span>;
  const key = emotionLabelKey(emotion);
  return (
    <span className={cn(badgeBase, emotionBadgeClass(emotion))}>{key ? t(key) : emotion}</span>
  );
}
