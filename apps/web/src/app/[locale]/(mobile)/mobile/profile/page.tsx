'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Building2, Check, ChevronRight, Languages, LogOut, Mail, Settings } from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { MobileNav } from '@/components/mobile/MobileNav';
import { cn } from '@/lib/utils';

/**
 * Mobile "Profile" tab: who is signed in, which organization the app is
 * showing, language, a link to the full settings and sign out.
 */
export default function MobileProfilePage() {
  const t = useTranslations('mobile.profile');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { user, organization, organizations, switchOrganization, clearAuth } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
  const initials = user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}` : '';

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }).catch(() => {});
      }
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      clearAuth();
      router.push('/login');
    }
  };

  const switchLanguage = () => {
    router.replace(pathname, { locale: locale === 'ar' ? 'en' : 'ar' });
  };

  return (
    <div className="min-h-screen pb-28">
      <div className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <h1 className="text-xl font-bold">{t('title')}</h1>
      </div>

      <div className="space-y-4 px-4 py-4">
        {/* Signed-in user */}
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold uppercase text-primary">
            {initials || '?'}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{displayName || '—'}</p>
            {user?.email && (
              <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate" dir="ltr">
                  {user.email}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Organization */}
        <section className="rounded-xl border bg-card">
          <h2 className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {t('organization')}
          </h2>
          {organizations.length > 1 ? (
            <ul>
              {organizations.map((membership) => {
                const selected = membership.org.id === organization?.id;
                return (
                  <li key={membership.id} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => switchOrganization(membership.org)}
                      aria-pressed={selected}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start text-sm transition-colors active:bg-muted/50"
                    >
                      <span className={cn('truncate', selected && 'font-medium')}>
                        {membership.org.name}
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm">{organization?.name ?? '—'}</p>
          )}
        </section>

        {/* Preferences */}
        <section className="rounded-xl border bg-card">
          <button
            type="button"
            onClick={switchLanguage}
            className="flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-sm transition-colors active:bg-muted/50"
          >
            <span className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-muted-foreground" />
              {t('language')}
            </span>
            <span className="text-muted-foreground">{t('switchLanguageTo')}</span>
          </button>
          <Link
            href="/settings"
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors active:bg-muted/50"
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              {t('allSettings')}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </Link>
        </section>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 px-4 py-3 text-sm font-medium text-destructive transition-colors active:bg-destructive/10 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          {t('logout')}
        </button>
      </div>

      <MobileNav />
    </div>
  );
}
