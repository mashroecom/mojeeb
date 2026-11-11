'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  getCurrentPushSubscription,
  getNotificationPermission,
  isPushNotificationSupported,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  type PushFailureReason,
  type PushSubscriptionData,
} from '@/lib/pwa';

/**
 * State of push notifications for this browser and the current organization.
 * - loading: still checking
 * - unsupported: the browser cannot do web push
 * - unavailable: the server has no VAPID keys (push is not configured)
 * - denied: notifications are blocked in the browser
 * - off: possible, but this browser is not subscribed
 * - on: subscribed and registered with the server
 */
export type PushStatus = 'loading' | 'unsupported' | 'unavailable' | 'denied' | 'off' | 'on';

/** Why enabling failed; `PushFailureReason` plus a failure to store it on the server. */
export type PushEnableFailure = PushFailureReason | 'server-error';

export type PushEnableResult = { ok: true } | { ok: false; reason: PushEnableFailure };

/** Error code the API answers with (HTTP 503) when it has no VAPID keys. */
const PUSH_NOT_CONFIGURED = 'PUSH_NOT_CONFIGURED';

/** Set when the user turns notifications off, so the app does not re-enable them by itself. */
const optOutKey = (userId: string) => `push_opt_out_${userId}`;
/** Set once the permission prompt has been shown automatically, so it is not shown again. */
const promptedKey = (userId: string) => `push_prompted_${userId}`;

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    // storage unavailable (private mode): the flag is only a convenience
  }
}

function isNotConfiguredError(error: unknown): boolean {
  const data = (error as { response?: { data?: { code?: string } } })?.response?.data;
  return data?.code === PUSH_NOT_CONFIGURED;
}

interface PushConfig {
  configured: boolean;
  publicKey: string | null;
}

/**
 * Ask the API whether push is configured and which VAPID public key to use.
 * Returns null when the answer could not be obtained.
 */
async function fetchPushConfig(): Promise<PushConfig | null> {
  try {
    const { data } = await api.get('/mobile/push/config');
    return data.data as PushConfig;
  } catch {
    return null;
  }
}

async function saveSubscription(orgId: string, subscription: PushSubscriptionData): Promise<void> {
  await api.post('/mobile/push/subscribe', {
    orgId,
    subscription,
    deviceInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    },
  });
}

/**
 * Work out the push state for this browser, registering an existing browser
 * subscription with the server along the way.
 */
async function resolvePushState(
  orgId: string,
): Promise<{ status: PushStatus; publicKey: string | null }> {
  if (!isPushNotificationSupported()) return { status: 'unsupported', publicKey: null };

  const config = await fetchPushConfig();
  const publicKey = config?.publicKey ?? null;
  const settle = (status: PushStatus) => ({ status, publicKey });

  if (config && !config.configured) return settle('unavailable');
  if (!publicKey && !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return settle('unavailable');

  const permission = getNotificationPermission();
  if (permission === 'denied') return settle('denied');

  const existing = permission === 'granted' ? await getCurrentPushSubscription(publicKey) : null;
  if (!existing) return settle('off');

  // Already subscribed in this browser: make sure the server knows it belongs
  // to this user and organization (same device, different login or org).
  try {
    await saveSubscription(orgId, existing);
    return settle('on');
  } catch (error) {
    return settle(isNotConfiguredError(error) ? 'unavailable' : 'off');
  }
}

/**
 * Stop the server from pushing to this browser (best effort), keeping the
 * browser's own subscription. Call before logging out so the next person to
 * use the device does not receive this account's notifications.
 */
export async function detachPushSubscription(): Promise<void> {
  try {
    const subscription = await getCurrentPushSubscription();
    if (!subscription) return;
    await api.delete('/mobile/push/unsubscribe', { data: { endpoint: subscription.endpoint } });
  } catch {
    // best effort
  }
}

/**
 * Push notification state and on/off actions for the signed-in user in the
 * current organization.
 */
export function usePushNotifications() {
  const userId = useAuthStore((state) => state.user?.id);
  const orgId = useAuthStore((state) => state.organization?.id);
  const [status, setStatus] = useState<PushStatus>('loading');
  const [busy, setBusy] = useState(false);
  const publicKeyRef = useRef<string | null>(null);

  const refresh = useCallback(async (): Promise<PushStatus> => {
    if (!orgId) return 'loading';
    const resolved = await resolvePushState(orgId);
    publicKeyRef.current = resolved.publicKey;
    return resolved.status;
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    void refresh().then((next) => {
      // After an organization switch a newer run owns the state
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const enable = useCallback(async (): Promise<PushEnableResult> => {
    if (!orgId) return { ok: false, reason: 'error' };
    setBusy(true);
    try {
      const result = await subscribeToPushNotifications(publicKeyRef.current);
      if (!result.success || !result.subscription) {
        const reason = result.reason ?? 'error';
        if (reason === 'unsupported') setStatus('unsupported');
        else if (reason === 'not-configured') setStatus('unavailable');
        else if (reason === 'denied') setStatus('denied');
        else setStatus('off');
        return { ok: false, reason };
      }

      try {
        await saveSubscription(orgId, result.subscription);
      } catch (error) {
        // Not stored on the server, so nothing would ever arrive: undo locally
        await unsubscribeFromPushNotifications();
        if (isNotConfiguredError(error)) {
          setStatus('unavailable');
          return { ok: false, reason: 'not-configured' };
        }
        setStatus('off');
        return { ok: false, reason: 'server-error' };
      }

      if (userId) writeFlag(optOutKey(userId), false);
      setStatus('on');
      return { ok: true };
    } finally {
      setBusy(false);
    }
  }, [orgId, userId]);

  const disable = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const subscription = await getCurrentPushSubscription();
      if (subscription) {
        try {
          await api.delete('/mobile/push/unsubscribe', {
            data: { endpoint: subscription.endpoint },
          });
        } catch {
          // Keep the browser subscription so server and browser stay in step
          return false;
        }
      }
      const unsubscribed = await unsubscribeFromPushNotifications();
      if (userId) writeFlag(optOutKey(userId), true);
      setStatus('off');
      return unsubscribed;
    } finally {
      setBusy(false);
    }
  }, [userId]);

  /**
   * Turn notifications on without being asked, when that is appropriate:
   * silently if the browser permission was already granted, or by showing the
   * permission prompt once per user and browser. Never after the user turned
   * them off. Returns null when nothing was attempted.
   */
  const enableAutomatically = useCallback(async (): Promise<PushEnableResult | null> => {
    if (!userId || status !== 'off') return null;
    if (readFlag(optOutKey(userId))) return null;

    if (getNotificationPermission() !== 'granted') {
      if (readFlag(promptedKey(userId))) return null;
      writeFlag(promptedKey(userId), true);
    }
    return enable();
  }, [enable, status, userId]);

  return { status, busy, enable, disable, enableAutomatically };
}
