'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Section } from './SectionWrapper';
import { Bell } from 'lucide-react';

type NotifPrefKey =
  | 'emailNewConversation'
  | 'emailHandoff'
  | 'emailLeadExtracted'
  | 'emailUsageWarning'
  | 'emailWeeklyDigest';

interface NotificationsSectionProps {
  notifPrefs: Record<NotifPrefKey, boolean> | null | undefined;
  updateNotifPrefsIsPending: boolean;
  onToggle: (patch: Partial<Record<NotifPrefKey, boolean>>) => void;
}

export function NotificationsSection({
  notifPrefs,
  updateNotifPrefsIsPending,
  onToggle,
}: NotificationsSectionProps) {
  const t = useTranslations('dashboard.settings');

  const items: { key: NotifPrefKey }[] = [
    { key: 'emailNewConversation' },
    { key: 'emailHandoff' },
    { key: 'emailLeadExtracted' },
    { key: 'emailUsageWarning' },
    { key: 'emailWeeklyDigest' },
  ];

  return (
    <Section icon={Bell} title={t('notificationPreferences')}>
      <div className="space-y-4">
        {items.map(({ key }) => {
          const isOn =
            notifPrefs?.[key] ??
            (key === 'emailNewConversation' ||
              key === 'emailHandoff' ||
              key === 'emailUsageWarning');
          return (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm">{t(key)}</span>
              <button
                type="button"
                role="switch"
                aria-checked={isOn}
                disabled={updateNotifPrefsIsPending}
                onClick={() => onToggle({ [key]: !isOn })}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors',
                  isOn ? 'bg-primary' : 'bg-muted',
                  updateNotifPrefsIsPending && 'opacity-50 cursor-not-allowed',
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform',
                    isOn ? 'translate-x-5' : 'translate-x-0.5',
                    'mt-0.5',
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
