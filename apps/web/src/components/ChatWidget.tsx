'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { usePublicSiteSettings } from '@/hooks/usePublicSiteSettings';

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

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(
  '/api/v1',
  '',
);

/**
 * ChatWidget — Injects the Mojeeb support chat widget using the
 * Integration ID configured by the admin in Site Settings.
 *
 * If support chat is disabled or no Integration ID is set, nothing renders.
 * Does NOT call /discover — always uses the admin-configured channel.
 */
export function ChatWidget() {
  const locale = useLocale();
  const { data: settings } = usePublicSiteSettings();

  const enabled = settings?.supportChatEnabled && settings?.supportChatChannelId;
  const channelId = settings?.supportChatChannelId || '';

  useEffect(() => {
    if (!enabled || !channelId) return;

    // Don't inject twice
    if (document.getElementById('mojeeb-chat-widget')) return;

    const script = document.createElement('script');
    script.id = 'mojeeb-chat-widget';
    script.src = `${API_BASE}/widget.js`;
    script.setAttribute('data-channel-id', channelId);
    script.setAttribute('data-mode', 'default');
    script.setAttribute(
      'data-config',
      JSON.stringify({
        primaryColor: settings?.supportChatColor || '#6366f1',
        position: settings?.supportChatPosition === 'left' ? 'bottom-left' : 'bottom-right',
        greeting:
          (locale === 'ar' ? settings?.supportChatWelcomeAr : settings?.supportChatWelcome) || '',
        direction: locale === 'ar' ? 'rtl' : 'ltr',
      }),
    );
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (window.MojeebWidget?.destroy) {
        window.MojeebWidget.destroy();
      }
      const existing = document.getElementById('mojeeb-chat-widget');
      if (existing) existing.remove();
    };
  }, [enabled, channelId, locale, settings]);

  return null;
}
