/**
 * Mojeeb Chat Widget Launcher
 *
 * Iframe-based chat widget that customers embed on their websites via a script tag.
 * Supports two modes: "default" (auto-injects a floating action button) and
 * "headless" (exposes a JS API for custom integration with no injected UI).
 *
 * Bundled as an IIFE by esbuild — this file exports nothing at runtime.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WidgetRemoteConfig {
  agentName?: string;
  greeting?: string;
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left';
  direction?: 'ltr' | 'rtl';
  frontendUrl?: string;
}

interface ResolvedConfig {
  channelId: string;
  apiUrl: string;
  agentName: string;
  greeting: string;
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  direction: 'ltr' | 'rtl';
  frontendUrl: string;
}

interface OpenOptions {
  message?: string;
}

interface MojeebWidgetAPI {
  open(options?: OpenOptions): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  attach?(selector: string, options?: OpenOptions): void;
  detach?(selector: string): void;
  getConfig?(): ResolvedConfig;
  destroy(): void;
  _version: string;
  _mode: 'default' | 'headless';
}

interface TrackedListener {
  target: EventTarget;
  event: string;
  handler: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}

interface WindowWithWidget extends Window {
  MojeebWidget?: MojeebWidgetAPI;
}

// ---------------------------------------------------------------------------
// IIFE — everything runs inside this closure
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  // =========================================================================
  // Constants
  // =========================================================================

  const VERSION = '1.0.0';
  const DEBUG = false; // Set true during development for verbose logging

  const ANIMATION = {
    DURATION: 300,
    ICON_TRANSITION: 150,
    NOTIFICATION_AUTO_DISMISS: 5000,
    IFRAME_DELAY: 50,
  } as const;

  const MOBILE_BREAKPOINT = 768;
  const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const TABLET_UA_REGEX = /iPad|Android(?!.*Mobile)|Windows.*Touch/i;

  const ELEMENT_IDS = {
    LAUNCHER: 'mojeeb-chat-launcher',
    BUTTON: 'mojeeb-chat-toggle-button',
    ICON_WRAPPER: 'mojeeb-chat-icon-wrapper',
    IFRAME: 'mojeeb-chat-iframe',
    CONTAINER: 'mojeeb-chat-container',
    STYLE: 'mojeeb-chat-style',
    NOTIFICATION: 'mojeeb-chat-notification',
  } as const;

  // =========================================================================
  // SVG Icons
  // =========================================================================

  const ICON_CHAT = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

  const ICON_ARROW_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>`;

  const ICON_ALERT = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

  // =========================================================================
  // Script tag detection and attribute reading
  // =========================================================================

  const scriptTag =
    (document.currentScript as HTMLScriptElement | null) ||
    document.getElementById('mojeeb-chat-widget');

  if (!scriptTag) {
    console.warn('[Mojeeb] Could not find the widget script tag. Ensure the script has id="mojeeb-chat-widget".');
    return;
  }

  const channelId = scriptTag.getAttribute('data-channel-id') || '';
  const mode: 'default' | 'headless' =
    (scriptTag.getAttribute('data-mode') as 'default' | 'headless') || 'default';

  let inlineConfig: Record<string, unknown> = {};
  try {
    inlineConfig = JSON.parse(scriptTag.getAttribute('data-config') || '{}');
  } catch (e) {
    console.warn('[Mojeeb] Invalid JSON in data-config attribute:', e);
  }

  if (!channelId) {
    console.warn('[Mojeeb] Missing data-channel-id on the widget script tag.');
    return;
  }

  // Derive the API base URL from the script src (strip /widget.js from the end)
  const scriptSrc = scriptTag.getAttribute('src') || '';
  const apiUrl = scriptSrc.replace(/\/widget\.js(\?.*)?$/, '') || window.location.origin;

  // =========================================================================
  // Shared state
  // =========================================================================

  let chatOpen = false;
  let currentNotification: HTMLElement | null = null;
  let notificationAutoTimer: ReturnType<typeof setTimeout> | null = null;
  let resolvedConfig: ResolvedConfig | null = null;

  // Track notification-specific listeners for cleanup
  const notificationListeners: TrackedListener[] = [];

  // Memory management: track all event listeners for cleanup
  const registeredListeners: TrackedListener[] = [];

  // =========================================================================
  // Utility functions
  // =========================================================================

  /** Play a short notification chime using Web Audio API (no external files needed). */
  function playNotificationSound(): void {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);          // A5
      osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.08);  // C6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio not available — silently ignore
    }
  }

  function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const ua = navigator.userAgent;
    const width = window.innerWidth;

    if (width <= MOBILE_BREAKPOINT || MOBILE_UA_REGEX.test(ua)) {
      return 'mobile';
    }
    if (TABLET_UA_REGEX.test(ua)) {
      return 'tablet';
    }
    return 'desktop';
  }

  function isMobile(): boolean {
    return detectDeviceType() === 'mobile';
  }

  function getElement(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  function removeElement(id: string): void {
    const el = getElement(id);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  function registerListener(
    target: EventTarget,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    target.addEventListener(event, handler, options);
    registeredListeners.push({ target, event, handler, options });
  }

  /** Generate a simple visitor ID and persist in localStorage. */
  function getVisitorId(): string {
    const STORAGE_KEY = 'mojeeb_visitor_id';
    try {
      let id = localStorage.getItem(STORAGE_KEY);
      if (!id) {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          id = crypto.randomUUID();
        } else {
          id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
        }
        localStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    } catch {
      // localStorage might be disabled
      return 'anon-' + Math.random().toString(36).substring(2, 15);
    }
  }

  // =========================================================================
  // Config fetch
  // =========================================================================

  function fetchConfig(): Promise<ResolvedConfig> {
    const url = `${apiUrl}/api/v1/webchat/${encodeURIComponent(channelId)}/config`;

    return fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Config fetch failed with HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const data: WidgetRemoteConfig = json.data || json;

        const config: ResolvedConfig = {
          channelId,
          apiUrl,
          agentName: data.agentName || (inlineConfig.agentName as string) || 'Support',
          greeting: data.greeting || (inlineConfig.greeting as string) || '',
          primaryColor: data.primaryColor || (inlineConfig.primaryColor as string) || '#6366f1',
          position: data.position || (inlineConfig.position as ResolvedConfig['position']) || 'bottom-right',
          direction: data.direction || (inlineConfig.direction as ResolvedConfig['direction']) || 'ltr',
          frontendUrl: data.frontendUrl || 'https://mojeeb.app',
        };

        return config;
      });
  }

  // =========================================================================
  // Chat URL builder
  // =========================================================================

  function buildChatUrl(config: ResolvedConfig, initialMessage?: string): string {
    const params = new URLSearchParams({
      channelId: config.channelId,
      primaryColor: config.primaryColor,
      direction: config.direction,
      agentName: config.agentName,
      visitorId: getVisitorId(),
      parentUrl: window.location.href,
      deviceType: detectDeviceType(),
      frontendUrl: config.frontendUrl,
    });

    if (initialMessage) {
      params.set('message', initialMessage);
    }

    return `${config.apiUrl}/chat?${params.toString()}`;
  }

  // =========================================================================
  // Icon transition helper
  // =========================================================================

  function updateLauncherIcon(svgHtml: string): void {
    const iconWrapper = getElement(ELEMENT_IDS.ICON_WRAPPER);
    if (!iconWrapper) return;

    iconWrapper.style.opacity = '0';
    iconWrapper.style.transform = 'scale(0.8)';

    setTimeout(() => {
      iconWrapper.innerHTML = svgHtml;
      iconWrapper.style.opacity = '1';
      iconWrapper.style.transform = 'scale(1)';
    }, ANIMATION.ICON_TRANSITION);
  }

  // =========================================================================
  // Notification system
  // =========================================================================

  function clearNotification(): void {
    if (notificationAutoTimer !== null) {
      clearTimeout(notificationAutoTimer);
      notificationAutoTimer = null;
    }
    // Remove notification-specific event listeners
    for (const entry of notificationListeners) {
      entry.target.removeEventListener(entry.event, entry.handler, entry.options);
    }
    notificationListeners.length = 0;

    if (currentNotification && currentNotification.parentNode) {
      currentNotification.parentNode.removeChild(currentNotification);
    }
    currentNotification = null;
  }

  function showNotification(messageContent: string, config: ResolvedConfig, autoDismiss = true): void {
    // Only show when chat is closed
    if (chatOpen) return;

    clearNotification();

    const launcher = getElement(ELEMENT_IDS.LAUNCHER);
    if (!launcher) return;

    const notification = document.createElement('div');
    notification.id = ELEMENT_IDS.NOTIFICATION;

    const isLeft = config.position === 'bottom-left';

    notification.style.cssText = `
      position: absolute;
      bottom: 70px;
      ${isLeft ? 'left: 0;' : 'right: 0;'}
      background-color: #ffffff;
      color: #333333;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      white-space: normal;
      word-break: break-word;
      min-width: 180px;
      max-width: 280px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
      opacity: 0;
      transform: translateY(10px);
      transition: opacity ${ANIMATION.DURATION}ms ease-out, transform ${ANIMATION.DURATION}ms ease-out;
      z-index: 9998;
      cursor: pointer;
      box-sizing: border-box;
    `;

    // Message text
    const messageSpan = document.createElement('span');
    messageSpan.textContent = messageContent;
    messageSpan.style.cssText = `
      display: block;
      padding-right: 12px;
    `;

    // Dismiss button (X)
    const dismissBtn = document.createElement('button');
    dismissBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    dismissBtn.style.cssText = `
      position: absolute;
      top: -8px;
      ${isLeft ? 'left: -8px;' : 'right: -8px;'}
      background: rgba(0, 0, 0, 0.8);
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      padding: 0;
      transition: background 150ms ease;
    `;

    const dismissClickHandler = (e: Event) => {
      e.stopPropagation();
      clearNotification();
    };
    const dismissKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearNotification();
    };
    document.addEventListener('keydown', dismissKeyHandler);
    notificationListeners.push(
      { target: document, event: 'keydown', handler: dismissKeyHandler },
    );
    const dismissOverHandler = () => {
      dismissBtn.style.background = 'rgba(0, 0, 0, 1)';
    };
    const dismissOutHandler = () => {
      dismissBtn.style.background = 'rgba(0, 0, 0, 0.8)';
    };
    const notificationClickHandler = () => {
      clearNotification();
      openChat(config);
    };

    dismissBtn.addEventListener('click', dismissClickHandler);
    dismissBtn.addEventListener('mouseover', dismissOverHandler);
    dismissBtn.addEventListener('mouseout', dismissOutHandler);
    notificationListeners.push(
      { target: dismissBtn, event: 'click', handler: dismissClickHandler },
      { target: dismissBtn, event: 'mouseover', handler: dismissOverHandler },
      { target: dismissBtn, event: 'mouseout', handler: dismissOutHandler },
    );

    notification.appendChild(messageSpan);
    notification.appendChild(dismissBtn);

    // Click notification -> open chat
    notification.addEventListener('click', notificationClickHandler);
    notificationListeners.push(
      { target: notification, event: 'click', handler: notificationClickHandler },
    );

    launcher.appendChild(notification);
    currentNotification = notification;

    // Play notification sound
    playNotificationSound();

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
      });
    });

    // Auto-dismiss after 5 seconds (only for transient notifications, not greeting)
    if (autoDismiss) {
      notificationAutoTimer = setTimeout(() => {
        if (currentNotification === notification) {
          notification.style.opacity = '0';
          notification.style.transform = 'translateY(10px)';
          setTimeout(() => {
            if (currentNotification === notification) {
              clearNotification();
            }
          }, ANIMATION.DURATION);
        }
      }, ANIMATION.NOTIFICATION_AUTO_DISMISS);
    }
  }

  // =========================================================================
  // Open / Close / Toggle chat
  // =========================================================================

  function openChat(config: ResolvedConfig, initialMessage?: string): void {
    if (chatOpen) return;
    if (getElement(ELEMENT_IDS.IFRAME)) return;

    clearNotification();

    try {
      const iframe = document.createElement('iframe');
      iframe.id = ELEMENT_IDS.IFRAME;
      iframe.src = buildChatUrl(config, initialMessage);
      iframe.setAttribute('allow', 'microphone; camera; clipboard-write');

      // Close chat if iframe fails to load (e.g. API down, network error)
      iframe.onerror = () => {
        closeChat(config);
      };

      if (isMobile()) {
        // ----- Mobile: fullscreen container -----
        const container = document.createElement('div');
        container.id = ELEMENT_IDS.CONTAINER;
        container.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          z-index: 10000;
          background: #ffffff;
          overflow: hidden;
          opacity: 0;
          transition: opacity ${ANIMATION.DURATION}ms ease;
        `;

        iframe.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
        `;

        document.body.appendChild(container);
        container.appendChild(iframe);

        // Hide FAB on mobile
        const launcher = getElement(ELEMENT_IDS.LAUNCHER);
        if (launcher) launcher.style.display = 'none';

        // Animate in
        setTimeout(() => {
          container.style.opacity = '1';
        }, ANIMATION.IFRAME_DELAY);
      } else {
        // ----- Desktop: positioned iframe with scale animation -----
        const isLeft = config.position === 'bottom-left';
        const horizontalPosition = isLeft ? 'left: 20px;' : 'right: 20px;';
        const transformOrigin = isLeft ? 'bottom left' : 'bottom right';

        // In headless mode there is no button, so position flush to bottom
        const bottomOffset = mode === 'headless' ? '20px' : '90px';

        iframe.style.cssText = `
          position: fixed;
          ${horizontalPosition}
          bottom: ${bottomOffset};
          width: 380px;
          height: 520px;
          border: none;
          border-radius: 16px;
          z-index: 10000;
          box-shadow: 0 8px 30px 4px rgba(0, 0, 0, 0.1);
          opacity: 0;
          transform: scale(0.8);
          transform-origin: ${transformOrigin};
          transition: opacity ${ANIMATION.DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
                      transform ${ANIMATION.DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1);
        `;

        document.body.appendChild(iframe);

        // Animate in
        setTimeout(() => {
          iframe.style.opacity = '1';
          iframe.style.transform = 'scale(1)';
        }, ANIMATION.IFRAME_DELAY);
      }

      chatOpen = true;

      // Update button accessibility state
      const fabBtn = getElement(ELEMENT_IDS.BUTTON);
      if (fabBtn) {
        fabBtn.setAttribute('aria-expanded', 'true');
        fabBtn.setAttribute('aria-label', 'Close chat');
      }

      // Update FAB icon to arrow-down (desktop only)
      if (!isMobile()) {
        updateLauncherIcon(ICON_ARROW_DOWN);
      }
    } catch (err) {
      console.error('[Mojeeb] Error opening chat:', err);
    }
  }

  function closeChat(): void {
    if (!chatOpen) return;

    const iframe = getElement(ELEMENT_IDS.IFRAME);
    const container = getElement(ELEMENT_IDS.CONTAINER);
    const launcher = getElement(ELEMENT_IDS.LAUNCHER);

    if (!iframe && !container) {
      chatOpen = false;
      return;
    }

    try {
      // Determine how the chat was opened based on DOM state (not current viewport)
      // If a container exists, it was opened in mobile/fullscreen mode
      if (container) {
        container.style.opacity = '0';
        setTimeout(() => {
          removeElement(ELEMENT_IDS.CONTAINER);
        }, ANIMATION.DURATION);
      } else if (iframe) {
        // Desktop mode: standalone iframe
        iframe.style.opacity = '0';
        iframe.style.transform = 'scale(0.8)';
        setTimeout(() => {
          removeElement(ELEMENT_IDS.IFRAME);
        }, ANIMATION.DURATION);
      }

      // Always re-show FAB after animation
      if (launcher) {
        setTimeout(() => {
          launcher.style.display = 'block';
        }, ANIMATION.DURATION);
      }

      chatOpen = false;

      // Update button accessibility state
      const fabBtnClose = getElement(ELEMENT_IDS.BUTTON);
      if (fabBtnClose) {
        fabBtnClose.setAttribute('aria-expanded', 'false');
        fabBtnClose.setAttribute('aria-label', 'Open chat');
      }

      // Update FAB icon back to chat
      updateLauncherIcon(ICON_CHAT);
    } catch (err) {
      console.error('[Mojeeb] Error closing chat:', err);
      // Force cleanup
      removeElement(ELEMENT_IDS.CONTAINER);
      removeElement(ELEMENT_IDS.IFRAME);
      chatOpen = false;
    }
  }

  function toggleChat(config: ResolvedConfig): void {
    if (chatOpen) {
      closeChat();
    } else {
      openChat(config);
    }
  }

  // =========================================================================
  // FAB Launcher injection (default mode)
  // =========================================================================

  function injectLauncher(config: ResolvedConfig): void {
    if (getElement(ELEMENT_IDS.LAUNCHER)) return;

    // Inject a style tag for hover/active effects that pure inline styles cannot handle
    const style = document.createElement('style');
    style.id = ELEMENT_IDS.STYLE;
    style.textContent = `
      #${ELEMENT_IDS.BUTTON} {
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      #${ELEMENT_IDS.BUTTON}:hover {
        transform: scale(1.05) !important;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25) !important;
      }
      #${ELEMENT_IDS.BUTTON}:active {
        transform: scale(0.95) !important;
      }
      @media (max-width: ${MOBILE_BREAKPOINT}px) {
        #${ELEMENT_IDS.BUTTON} {
          width: 52px !important;
          height: 52px !important;
        }
        #${ELEMENT_IDS.BUTTON} svg {
          width: 22px !important;
          height: 22px !important;
        }
      }
    `;
    document.head.appendChild(style);

    // Launcher wrapper (fixed position)
    const launcher = document.createElement('div');
    launcher.id = ELEMENT_IDS.LAUNCHER;
    const isLeft = config.position === 'bottom-left';
    launcher.style.cssText = `
      position: fixed;
      ${isLeft ? 'left: 20px;' : 'right: 20px;'}
      bottom: 20px;
      z-index: 9999;
    `;

    // FAB button
    const button = document.createElement('button');
    button.id = ELEMENT_IDS.BUTTON;
    button.setAttribute('aria-label', 'Open chat');
    button.setAttribute('aria-expanded', 'false');
    button.style.cssText = `
      background: ${config.primaryColor};
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      position: relative;
      z-index: 10001;
      padding: 0;
      outline: none;
    `;

    // Icon wrapper (for animated transitions between chat/arrow icons)
    const iconWrapper = document.createElement('div');
    iconWrapper.id = ELEMENT_IDS.ICON_WRAPPER;
    iconWrapper.innerHTML = ICON_CHAT;
    iconWrapper.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity ${ANIMATION.DURATION}ms ease, transform ${ANIMATION.DURATION}ms ease;
    `;

    button.appendChild(iconWrapper);
    button.addEventListener('click', () => toggleChat(config));

    launcher.appendChild(button);
    document.body.appendChild(launcher);
  }

  // =========================================================================
  // Fallback launcher (shown when config fetch fails)
  // =========================================================================

  function injectFallbackLauncher(): void {
    removeElement(ELEMENT_IDS.LAUNCHER);
    removeElement(ELEMENT_IDS.STYLE);

    const launcher = document.createElement('div');
    launcher.id = ELEMENT_IDS.LAUNCHER;
    launcher.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 9999;
    `;

    const button = document.createElement('button');
    button.id = ELEMENT_IDS.BUTTON;
    button.setAttribute('aria-label', 'Chat unavailable');
    button.style.cssText = `
      background: #dc3545;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      padding: 0;
      outline: none;
    `;

    const iconWrapper = document.createElement('div');
    iconWrapper.id = ELEMENT_IDS.ICON_WRAPPER;
    iconWrapper.innerHTML = ICON_ALERT;
    iconWrapper.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    button.appendChild(iconWrapper);

    button.addEventListener('click', () => {
      // Retry config fetch on click
      button.style.opacity = '0.5';
      button.style.pointerEvents = 'none';
      fetchConfig()
        .then((config) => {
          removeElement(ELEMENT_IDS.LAUNCHER);
          if (mode === 'headless') {
            initHeadlessMode(config);
          } else {
            initDefaultMode(config);
          }
        })
        .catch(() => {
          button.style.opacity = '1';
          button.style.pointerEvents = 'auto';
        });
    });

    launcher.appendChild(button);
    document.body.appendChild(launcher);
  }

  // =========================================================================
  // PostMessage handler
  // =========================================================================

  /** Derive the expected iframe origin from the API URL. */
  function getExpectedOrigin(): string | null {
    try {
      return new URL(apiUrl).origin;
    } catch {
      return null;
    }
  }

  function handlePostMessage(event: MessageEvent): void {
    try {
      // Validate origin — only accept messages from our own iframe (API server)
      const expected = getExpectedOrigin();
      if (!expected) return;
      if (event.origin !== expected) return;

      if (!event.data || typeof event.data !== 'object') return;

      const { type } = event.data;

      if (type === 'closeWidget') {
        closeChat();
        return;
      }

      if (type === 'newMessage' && event.data.messageContent && !chatOpen && resolvedConfig) {
        showNotification(event.data.messageContent, resolvedConfig);
      }
    } catch (err) {
      console.error('[Mojeeb] Error handling postMessage:', err);
    }
  }

  // =========================================================================
  // Destroy — clean up everything
  // =========================================================================

  function destroyWidget(): void {
    try {
      // Clear resize timer
      if (resizeTimer !== null) {
        clearTimeout(resizeTimer);
        resizeTimer = null;
      }

      // Remove all tracked event listeners
      for (const entry of registeredListeners) {
        entry.target.removeEventListener(entry.event, entry.handler, entry.options);
      }
      registeredListeners.length = 0;

      // Close the chat (removes iframe/container)
      closeChat();

      // Remove DOM elements
      removeElement(ELEMENT_IDS.LAUNCHER);
      removeElement(ELEMENT_IDS.STYLE);
      clearNotification();

      // Reset state
      chatOpen = false;
      currentNotification = null;
      resolvedConfig = null;

      // Remove global API
      delete (window as WindowWithWidget).MojeebWidget;

      if (DEBUG) console.log('[Mojeeb] Widget destroyed and all resources cleaned up.');
    } catch (err) {
      console.error('[Mojeeb] Error during widget destruction:', err);
    }
  }

  // =========================================================================
  // Mode initializers
  // =========================================================================

  function initDefaultMode(config: ResolvedConfig): void {
    resolvedConfig = config;

    injectLauncher(config);

    // Show greeting as notification popup above FAB after 3 seconds (persists until dismissed)
    if (config.greeting) {
      setTimeout(() => {
        if (!chatOpen) {
          showNotification(config.greeting, config, false);
        }
      }, 3000);
    }

    // Expose the public API
    (window as WindowWithWidget).MojeebWidget = {
      open(options?: OpenOptions) {
        if (!chatOpen) openChat(config, options?.message);
      },
      close() {
        if (chatOpen) closeChat();
      },
      toggle() {
        toggleChat(config);
      },
      isOpen() {
        return chatOpen;
      },
      destroy: destroyWidget,
      _version: VERSION,
      _mode: 'default',
    };
  }

  function initHeadlessMode(config: ResolvedConfig): void {
    resolvedConfig = config;

    // Track elements attached via .attach() for cleanup
    const attachedElements = new Map<Element, EventListenerOrEventListenerObject>();

    (window as WindowWithWidget).MojeebWidget = {
      open(options?: OpenOptions) {
        if (!chatOpen) openChat(config, options?.message);
      },

      close() {
        if (chatOpen) closeChat();
      },

      toggle() {
        toggleChat(config);
      },

      isOpen() {
        return chatOpen;
      },

      attach(selector: string, options?: OpenOptions) {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length === 0) {
            console.warn('[Mojeeb] No elements found for selector:', selector);
            return;
          }

          elements.forEach((el) => {
            if (attachedElements.has(el)) {
              console.warn('[Mojeeb] Element already attached:', el);
              return;
            }

            const handler = (e: Event) => {
              e.preventDefault();
              e.stopPropagation();
              if (!chatOpen) {
                openChat(config, options?.message);
              } else {
                closeChat();
              }
            };

            el.addEventListener('click', handler);
            attachedElements.set(el, handler);

            (el as HTMLElement).style.cursor = 'pointer';
          });

          if (DEBUG) console.log(`[Mojeeb] Attached to ${elements.length} element(s) matching "${selector}".`);
        } catch (err) {
          console.error('[Mojeeb] Error attaching to selector:', selector, err);
        }
      },

      detach(selector: string) {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => {
            const handler = attachedElements.get(el);
            if (handler) {
              el.removeEventListener('click', handler);
              attachedElements.delete(el);
            }
          });
          if (DEBUG) console.log(`[Mojeeb] Detached from elements matching "${selector}".`);
        } catch (err) {
          console.error('[Mojeeb] Error detaching from selector:', selector, err);
        }
      },

      getConfig() {
        // Return a shallow copy so callers cannot mutate internal config
        return { ...config };
      },

      destroy() {
        // Clean up all attached elements first
        attachedElements.forEach((handler, el) => {
          el.removeEventListener('click', handler);
        });
        attachedElements.clear();

        destroyWidget();
      },

      _version: VERSION,
      _mode: 'headless',
    };

    if (DEBUG) console.log('[Mojeeb] Headless mode ready. Use window.MojeebWidget to control the widget.');
  }

  // =========================================================================
  // Register global event listeners
  // =========================================================================

  registerListener(window, 'message', handlePostMessage as EventListener);

  // Handle window resize — close and re-render if device type changes while chat is open
  let prevMobile = isMobile();
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  registerListener(window, 'resize', () => {
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const nowMobile = isMobile();
      if (prevMobile !== nowMobile && chatOpen && resolvedConfig) {
        closeChat();
        setTimeout(() => {
          if (resolvedConfig) openChat(resolvedConfig);
        }, ANIMATION.DURATION + 50);
      }
      prevMobile = nowMobile;
    }, 250);
  });

  // =========================================================================
  // Main initialization flow
  // =========================================================================

  if (DEBUG) console.log(`[Mojeeb] Initializing widget in "${mode}" mode for channel "${channelId}".`);

  fetchConfig()
    .then((config) => {
      if (mode === 'headless') {
        initHeadlessMode(config);
      } else {
        initDefaultMode(config);
      }
    })
    .catch((err) => {
      console.error('[Mojeeb] Failed to load widget config:', err);
      if (mode !== 'headless') {
        injectFallbackLauncher();
      }
    });
})();
