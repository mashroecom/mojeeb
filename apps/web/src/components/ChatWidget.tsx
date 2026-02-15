'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';

declare global {
  interface Window {
    MojeebWidget?: {
      open(options?: { message?: string }): void;
      close(): void;
      toggle(): void;
      isOpen(): boolean;
      destroy(): void;
    };
  }
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace('/api/v1', '');

export function ChatWidget() {
  const locale = useLocale();

  useEffect(() => {
    // Don't inject twice
    if (document.getElementById('mojeeb-chat-widget')) return;

    // Step 1: Discover the active webchat channel
    fetch(`${API_BASE}/api/v1/webchat/discover`)
      .then((res) => {
        if (!res.ok) throw new Error('No active webchat channel');
        return res.json();
      })
      .then((json) => {
        const { channelId } = json.data;
        if (!channelId) return;

        // Step 2: Inject the widget script with data attributes
        const script = document.createElement('script');
        script.id = 'mojeeb-chat-widget';
        script.src = `${API_BASE}/widget.js`;
        script.setAttribute('data-channel-id', channelId);
        script.setAttribute('data-mode', 'default');
        script.setAttribute(
          'data-config',
          JSON.stringify({
            direction: locale === 'ar' ? 'rtl' : 'ltr',
          }),
        );
        script.async = true;
        document.body.appendChild(script);
      })
      .catch(() => {
        // No active webchat channel — skip widget
      });

    return () => {
      // Cleanup on unmount
      if (window.MojeebWidget?.destroy) {
        window.MojeebWidget.destroy();
      }
      const existing = document.getElementById('mojeeb-chat-widget');
      if (existing) existing.remove();
    };
  }, [locale]);

  return null;
}
