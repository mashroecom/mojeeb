'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PublicSiteSettings {
  siteName: string;
  description: string;
  keywords: string;
  primaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  supportEmail: string | null;
  supportChatEnabled: boolean;
  supportChatChannelId: string | null;
  supportChatColor?: string | null;
  supportChatPosition?: string | null;
  supportChatWelcome?: string | null;
  supportChatWelcomeAr?: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

export const publicSiteSettingsKeys = {
  settings: ['public', 'site-settings'] as const,
};

export function usePublicSiteSettings() {
  return useQuery({
    queryKey: publicSiteSettingsKeys.settings,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<PublicSiteSettings>>(
        '/public/site-settings',
      );
      return data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
