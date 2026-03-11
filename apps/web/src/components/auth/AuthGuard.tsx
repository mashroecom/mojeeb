'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { setOnboardingCookie } from '@/lib/auth-cookies';
import { Loader2 } from 'lucide-react';

/**
 * Wraps dashboard & onboarding pages. Ensures:
 * 1. User is authenticated (has token + valid session)
 * 2. Non-onboarded users are forced to /onboarding
 * 3. Completed users on /onboarding are sent to /dashboard
 *
 * Children are NOT rendered until checks pass — no flash of content.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setAuth, clearAuth } = useAuthStore();
  const [ready, setReady] = useState(false);
  const redirectingRef = useRef(false);
  const checkedRef = useRef(false);

  const isOnboardingPage = pathname === '/onboarding';

  const checkAuth = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      clearAuth();
      router.replace('/login');
      return;
    }

    api
      .get('/auth/me')
      .then((res) => {
        if (redirectingRef.current) return;
        const profile = res.data?.data;
        if (!profile?.id) {
          clearAuth();
          router.replace('/login');
          return;
        }
        const memberships = Array.isArray(profile.memberships) ? profile.memberships : [];
        const org = memberships[0]?.org;
        if (!org) {
          clearAuth();
          router.replace('/login');
          return;
        }

        const userData = {
          id: profile.id,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          isSuperAdmin: profile.isSuperAdmin,
          onboardingCompleted: profile.onboardingCompleted,
        };
        setAuth(
          userData,
          org,
          memberships.map((m: any) => ({ id: m.id, role: m.role, org: m.org })),
        );

        // Only use onboardingCompleted flag — NOT hasAgents.
        // Once a user completes onboarding, they should never be sent back.
        const needsOnboarding = profile.onboardingCompleted !== true;
        setOnboardingCookie(!needsOnboarding);

        if (redirectingRef.current) return;

        if (needsOnboarding && !isOnboardingPage) {
          redirectingRef.current = true;
          router.replace('/onboarding');
          return;
        }

        if (!needsOnboarding && isOnboardingPage) {
          redirectingRef.current = true;
          router.replace('/dashboard');
          return;
        }

        checkedRef.current = true;
        setReady(true);
      })
      .catch(() => {
        if (redirectingRef.current) return;
        clearAuth();
        router.replace('/login');
      });
  }, [isOnboardingPage, setAuth, clearAuth, router]);

  useEffect(() => {
    redirectingRef.current = false;

    // If already checked and just navigating between dashboard pages, stay ready
    if (checkedRef.current) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        setReady(true);
        return;
      }
    }

    setReady(false);
    checkAuth();
  }, [pathname, checkAuth]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
