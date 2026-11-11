'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, BarChart3, Bell } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/hooks/useToast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
  pushFailureMessageKey,
  pushStatusMessageKey,
} from '@/components/mobile/PushNotificationToggle';

export default function MobilePage() {
  const t = useTranslations('mobile.push');
  const { organization } = useAuthStore();
  const { status, busy, enable, enableAutomatically } = usePushNotifications();

  // First visit: offer notifications once (or re-subscribe silently when the
  // browser permission is already granted). Unsupported browsers, a blocked
  // permission and a server without push are shown on the card below instead.
  useEffect(() => {
    if (!organization?.id || status !== 'off') return;

    // Small delay to let the page render first
    const timer = setTimeout(async () => {
      const result = await enableAutomatically();
      if (result?.ok) toast.success(t('subscribed'));
    }, 1000);

    return () => clearTimeout(timer);
  }, [organization?.id, status, enableAutomatically, t]);

  const handleEnable = async () => {
    const result = await enable();
    if (result.ok) toast.success(t('subscribed'));
    else toast.error(t(pushFailureMessageKey(result.reason)));
  };

  return (
    <div className="container mx-auto max-w-md p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Mobile Admin</h1>
        <p className="text-muted-foreground">
          Access your conversations, analytics, and notifications on the go
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold">Inbox</h2>
          </div>
          <p className="text-sm text-muted-foreground">View and manage customer conversations</p>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold">Analytics</h2>
          </div>
          <p className="text-sm text-muted-foreground">Track key metrics and performance</p>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold">Notifications</h2>
          </div>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm" data-testid="push-status">
              {t(pushStatusMessageKey(status))}
            </p>
            {status === 'off' && (
              <button
                type="button"
                onClick={handleEnable}
                disabled={busy}
                className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
              >
                {t('enable')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
