/**
 * Custom service worker code.
 *
 * @ducanh2912/next-pwa compiles this file (`customWorkerSrc` in
 * next.config.ts) into `public/worker-<hash>.js` and imports it from the
 * generated `sw.js` at build time. Do not edit `public/sw.js` by hand.
 * The service worker is disabled in development, so this only runs in a
 * production build.
 *
 * Handles Web Push: shows the notification sent by the API
 * (apps/api/src/services/pushNotification.service.ts) and opens the right page
 * when it is clicked.
 */

// The app's tsconfig targets the DOM, not the worker scope, so the few
// service-worker types used here are declared locally.
interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  type?: string;
  conversationId?: string;
  requireInteraction?: boolean;
}

interface WorkerWindowClient {
  url: string;
  focus(): Promise<WorkerWindowClient>;
  navigate(url: string): Promise<WorkerWindowClient | null>;
}

interface WorkerScope {
  location: { origin: string };
  registration: {
    showNotification(
      title: string,
      options?: NotificationOptions & { requireInteraction?: boolean },
    ): Promise<void>;
  };
  clients: {
    matchAll(options: {
      type: 'window';
      includeUncontrolled: boolean;
    }): Promise<WorkerWindowClient[]>;
    openWindow(url: string): Promise<WorkerWindowClient | null>;
  };
  addEventListener(type: 'push', listener: (event: WorkerPushEvent) => void): void;
  addEventListener(
    type: 'notificationclick',
    listener: (event: WorkerNotificationEvent) => void,
  ): void;
}

interface WorkerExtendableEvent {
  waitUntil(promise: Promise<unknown>): void;
}

interface WorkerPushEvent extends WorkerExtendableEvent {
  data: { json(): unknown; text(): string } | null;
}

interface WorkerNotificationEvent extends WorkerExtendableEvent {
  notification: { close(): void; data?: { url?: string } };
}

const sw = self as unknown as WorkerScope;

const DEFAULT_TITLE = 'Mojeeb';
const DEFAULT_ICON = '/icons/icon-192.png';
const FALLBACK_URL = '/mobile/inbox';

/** Only ever open pages of this app, whatever the payload says. */
function sameOriginUrl(raw: string | undefined): string {
  try {
    const url = new URL(raw || FALLBACK_URL, sw.location.origin);
    if (url.origin === sw.location.origin) return url.href;
  } catch {
    // fall through
  }
  return new URL(FALLBACK_URL, sw.location.origin).href;
}

function readPayload(event: WorkerPushEvent): PushPayload {
  if (!event.data) return {};
  try {
    const parsed = event.data.json();
    return parsed && typeof parsed === 'object' ? (parsed as PushPayload) : {};
  } catch {
    // Not JSON: show the text as the body
    return { body: event.data.text() };
  }
}

sw.addEventListener('push', (event) => {
  const payload = readPayload(event);

  // A push must always result in a visible notification (userVisibleOnly).
  event.waitUntil(
    sw.registration.showNotification(payload.title || DEFAULT_TITLE, {
      body: payload.body || '',
      icon: DEFAULT_ICON,
      badge: DEFAULT_ICON,
      tag: payload.tag,
      requireInteraction: payload.requireInteraction === true,
      data: {
        url: payload.url,
        type: payload.type,
        conversationId: payload.conversationId,
      },
    }),
  );
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = sameOriginUrl(event.notification.data?.url);

  event.waitUntil(
    (async () => {
      const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // Already showing the page: just bring it to the front
      const exact = windows.find((client) => client.url === target);
      if (exact) {
        await exact.focus().catch(() => undefined);
        return;
      }

      // Reuse an open tab of the app: take it to the page, then focus it
      const existing = windows[0];
      if (existing) {
        // navigate() is refused for tabs this worker does not control
        const navigated = await existing.navigate(target).catch(() => null);
        if (navigated) {
          await navigated.focus().catch(() => undefined);
          return;
        }
      }

      await sw.clients.openWindow(target);
    })(),
  );
});

export {};
