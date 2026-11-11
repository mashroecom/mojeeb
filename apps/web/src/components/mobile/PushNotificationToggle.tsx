'use client';

import { useTranslations } from 'next-intl';
import { Bell, BellOff } from 'lucide-react';
import { toast } from '@/hooks/useToast';
import {
  usePushNotifications,
  type PushEnableFailure,
  type PushStatus,
} from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

type PushMessageKey =
  | 'notSupported'
  | 'notConfigured'
  | 'blockedHint'
  | 'notReady'
  | 'permissionDismissed'
  | 'subscribeFailed';

/** Message (under `mobile.push`) explaining why notifications could not be turned on. */
export function pushFailureMessageKey(reason: PushEnableFailure): PushMessageKey {
  switch (reason) {
    case 'unsupported':
      return 'notSupported';
    case 'not-configured':
      return 'notConfigured';
    case 'denied':
      return 'blockedHint';
    case 'no-service-worker':
      return 'notReady';
    case 'dismissed':
      return 'permissionDismissed';
    default:
      return 'subscribeFailed';
  }
}

/** Status line (under `mobile.push`) for each push state. */
export function pushStatusMessageKey(
  status: PushStatus,
): 'checking' | 'notSupported' | 'notConfigured' | 'blockedHint' | 'statusOn' | 'statusOff' {
  switch (status) {
    case 'loading':
      return 'checking';
    case 'unsupported':
      return 'notSupported';
    case 'unavailable':
      return 'notConfigured';
    case 'denied':
      return 'blockedHint';
    case 'on':
      return 'statusOn';
    default:
      return 'statusOff';
  }
}

/**
 * On/off row for push notifications on this device. Shows why the switch is
 * unavailable when the browser, its permission or the server rules it out.
 */
export function PushNotificationToggle() {
  const t = useTranslations('mobile.push');
  const { status, busy, enable, disable } = usePushNotifications();

  const isOn = status === 'on';
  const canToggle = status === 'on' || status === 'off';

  const toggle = async () => {
    if (isOn) {
      const turnedOff = await disable();
      if (turnedOff) toast.success(t('unsubscribed'));
      else toast.error(t('unsubscribeFailed'));
      return;
    }

    const result = await enable();
    if (result.ok) toast.success(t('subscribed'));
    else toast.error(t(pushFailureMessageKey(result.reason)));
  };

  const Icon = isOn ? Bell : BellOff;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="flex min-w-0 items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block">{t('title')}</span>
          <span className="block text-xs text-muted-foreground" data-testid="push-status">
            {t(pushStatusMessageKey(status))}
          </span>
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={t('toggleLabel')}
        aria-busy={busy}
        disabled={!canToggle || busy}
        onClick={toggle}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          isOn ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            isOn ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}
