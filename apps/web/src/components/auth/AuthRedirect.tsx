'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useAuthStore } from '@/stores/authStore';
import { routing } from '@/i18n/routing';

export function AuthRedirect({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // If user is already authenticated, hard redirect to dashboard
    if (isAuthenticated) {
      const path = locale === routing.defaultLocale ? '/dashboard' : `/${locale}/dashboard`;
      window.location.href = path;
    }
  }, [isAuthenticated, locale]);

  // Don't render children if already authenticated
  if (isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
