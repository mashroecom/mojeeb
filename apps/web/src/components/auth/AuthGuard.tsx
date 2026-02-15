'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

/**
 * Wraps dashboard pages. On mount it checks if the auth store is hydrated.
 * If the Zustand store has no user but localStorage has a token, it calls
 * GET /auth/me to restore the session. If there is no token at all it
 * redirects to /login.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, organization, setAuth, clearAuth } = useAuthStore();
  const [checking, setChecking] = useState(!user);

  useEffect(() => {
    // Already hydrated
    if (user && organization) {
      setChecking(false);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      clearAuth();
      router.replace('/login');
      return;
    }

    // Hydrate from API
    api
      .get('/auth/me')
      .then((res) => {
        const profile = res.data?.data;
        if (!profile || !profile.id) {
          clearAuth();
          router.replace('/login');
          return;
        }
        const memberships = Array.isArray(profile.memberships) ? profile.memberships : [];
        const org = memberships[0]?.org;
        if (org) {
          setAuth(
            {
              id: profile.id,
              email: profile.email,
              firstName: profile.firstName,
              lastName: profile.lastName,
              avatarUrl: profile.avatarUrl,
              isSuperAdmin: profile.isSuperAdmin,
            },
            org,
            memberships.map((m: any) => ({ id: m.id, role: m.role, org: m.org })),
          );
        } else {
          // User has no organization — shouldn't happen but handle gracefully
          clearAuth();
          router.replace('/login');
        }
      })
      .catch(() => {
        clearAuth();
        router.replace('/login');
      })
      .finally(() => setChecking(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
