/**
 * PWA Push Notification Utility
 *
 * Handles web push notification subscriptions for the mobile PWA.
 * Manages permission requests, service worker registration, and push subscriptions.
 */

/**
 * Type definition for push subscription that matches backend expectations
 */
export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Result of a subscription attempt
 */
export interface SubscriptionResult {
  success: boolean;
  subscription?: PushSubscriptionData;
  error?: string;
}

/**
 * Check if the browser supports push notifications
 */
export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get the current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'default';
  }

  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported in this browser');
  }

  if (getNotificationPermission() === 'granted') {
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    throw new Error('Failed to request notification permission');
  }
}

/**
 * Get the service worker registration
 */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported');
  }

  try {
    // Wait for the service worker to be ready
    const registration = await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.error('Error getting service worker registration:', error);
    throw new Error('Failed to get service worker registration');
  }
}

/**
 * Convert a base64 string to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Convert PushSubscription to the format expected by the backend
 */
function convertSubscriptionToData(subscription: PushSubscription): PushSubscriptionData {
  const subscriptionJson = subscription.toJSON();

  if (!subscriptionJson.endpoint || !subscriptionJson.keys) {
    throw new Error('Invalid subscription format');
  }

  return {
    endpoint: subscriptionJson.endpoint,
    keys: {
      p256dh: subscriptionJson.keys.p256dh || '',
      auth: subscriptionJson.keys.auth || '',
    },
  };
}

/**
 * Subscribe to push notifications
 *
 * @param vapidPublicKey - The VAPID public key for the application
 * @returns SubscriptionResult with the subscription data or error
 */
export async function subscribeToPushNotifications(
  vapidPublicKey?: string,
): Promise<SubscriptionResult> {
  try {
    // Check browser support
    if (!isPushNotificationSupported()) {
      return {
        success: false,
        error: 'Push notifications are not supported in this browser',
      };
    }

    // Get VAPID public key from environment or parameter
    const publicKey = vapidPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!publicKey) {
      return {
        success: false,
        error: 'VAPID public key is not configured',
      };
    }

    // Request permission
    const permission = await requestNotificationPermission();

    if (permission !== 'granted') {
      return {
        success: false,
        error: `Notification permission ${permission}`,
      };
    }

    // Get service worker registration
    const registration = await getServiceWorkerRegistration();

    // Check for existing subscription
    const existingSubscription = await registration.pushManager.getSubscription();

    // If there's an existing subscription, unsubscribe first to get a fresh one
    if (existingSubscription) {
      await existingSubscription.unsubscribe();
    }

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // Convert to backend format
    const subscriptionData = convertSubscriptionToData(subscription);

    return {
      success: true,
      subscription: subscriptionData,
    };
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to subscribe to push notifications',
    };
  }
}

/**
 * Get the current push subscription
 *
 * @returns The current subscription data or null if not subscribed
 */
export async function getCurrentPushSubscription(): Promise<PushSubscriptionData | null> {
  try {
    if (!isPushNotificationSupported()) {
      return null;
    }

    const registration = await getServiceWorkerRegistration();
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return null;
    }

    return convertSubscriptionToData(subscription);
  } catch (error) {
    console.error('Error getting current push subscription:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 *
 * @returns true if successfully unsubscribed, false otherwise
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    if (!isPushNotificationSupported()) {
      return false;
    }

    const registration = await getServiceWorkerRegistration();
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return true; // Already unsubscribed
    }

    const success = await subscription.unsubscribe();
    return success;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}

/**
 * Check if the user is currently subscribed to push notifications
 *
 * @returns true if subscribed, false otherwise
 */
export async function isSubscribedToPushNotifications(): Promise<boolean> {
  try {
    if (!isPushNotificationSupported()) {
      return false;
    }

    const registration = await getServiceWorkerRegistration();
    const subscription = await registration.pushManager.getSubscription();

    return subscription !== null;
  } catch (error) {
    console.error('Error checking push subscription status:', error);
    return false;
  }
}

/**
 * Request notification permission and subscribe to push notifications in one step
 * This is a convenience function that combines permission request and subscription
 *
 * @param vapidPublicKey - Optional VAPID public key (uses env var if not provided)
 * @returns SubscriptionResult with the subscription data or error
 */
export async function setupPushNotifications(vapidPublicKey?: string): Promise<SubscriptionResult> {
  return subscribeToPushNotifications(vapidPublicKey);
}
