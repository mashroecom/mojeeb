'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, BarChart3, Bell } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import {
  subscribeToPushNotifications,
  isPushNotificationSupported,
  getNotificationPermission,
} from '@/lib/pwa';

export default function MobilePage() {
  const t = useTranslations('mobile.push');
  const { organization } = useAuthStore();
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    // Only run on first mount and if user has an organization
    if (!organization?.id) return;

    // Check if we've already attempted subscription
    const hasAttemptedSubscription = localStorage.getItem(
      `push_subscription_attempted_${organization.id}`,
    );
    if (hasAttemptedSubscription) return;

    // Check browser support
    if (!isPushNotificationSupported()) {
      return;
    }

    // Check current permission status
    const permission = getNotificationPermission();
    if (permission === 'denied') {
      localStorage.setItem(`push_subscription_attempted_${organization.id}`, 'denied');
      return;
    }

    // If already granted, check if we have a subscription
    if (permission === 'granted') {
      return;
    }

    // Attempt to subscribe to push notifications
    const setupPushNotifications = async () => {
      setIsSubscribing(true);

      try {
        const result = await subscribeToPushNotifications();

        if (!result.success) {
          // Don't show error toast for user denying permission
          if (result.error?.includes('denied')) {
            localStorage.setItem(`push_subscription_attempted_${organization.id}`, 'denied');
          }
          return;
        }

        if (result.subscription) {
          // Save subscription to backend
          await api.post('/mobile/push/subscribe', {
            orgId: organization.id,
            subscription: result.subscription,
            deviceInfo: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
            },
          });

          // Mark as successfully subscribed
          localStorage.setItem(`push_subscription_attempted_${organization.id}`, 'success');

          toast.success(t('subscribed'));
        }
      } catch (error) {
        // Silent fail - don't interrupt the user experience
      } finally {
        setIsSubscribing(false);
      }
    };

    // Small delay to let the page render first
    const timer = setTimeout(setupPushNotifications, 1000);

    return () => clearTimeout(timer);
  }, [organization?.id, t]);

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
          <p className="text-sm text-muted-foreground">
            Stay updated with push notifications
            {isSubscribing && ' (enabling...)'}
          </p>
        </div>
      </div>
    </div>
  );
}
