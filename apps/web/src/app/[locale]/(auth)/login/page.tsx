'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@/stores/authStore';
import { setAuthCookie, setOnboardingCookie } from '@/lib/auth-cookies';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { useZodForm } from '@/hooks/useZodForm';
import { loginSchema } from '@mojeeb/shared-utils';

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const form = useZodForm({
    schema: loginSchema,
    initialValues: {
      email: '',
      password: '',
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate form
    const isValid = await form.handleSubmit();
    if (!isValid) {
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/login', form.values);
      const { tokens, user, organization, organizations } = response.data.data;

      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      setAuthCookie(tokens.accessToken);
      setOnboardingCookie(user?.onboardingCompleted === true);

      if (user && organization) {
        setAuth(user, organization, organizations);
      }

      if (user?.onboardingCompleted === true) {
        router.push('/dashboard');
      } else {
        router.push('/onboarding');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || '';
      if (msg.includes('Invalid email or password')) setError(t('invalidCredentials'));
      else if (msg.includes('suspended')) setError(t('accountSuspended'));
      else setError(t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium">
            {t('email')}
          </label>
          <input
            id="login-email"
            type="email"
            value={form.values.email || ''}
            onChange={form.handleChange('email')}
            onBlur={form.handleBlur('email')}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            placeholder="name@company.com"
            dir="ltr"
            aria-invalid={form.errors.email ? true : undefined}
            aria-describedby={form.errors.email ? 'login-email-error' : undefined}
          />
          {form.errors.email && (
            <p id="login-email-error" className="mt-1 text-xs text-destructive" aria-live="polite">
              {form.errors.email}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm font-medium">
              {t('password')}
            </label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              {t('forgotPassword')}
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            value={form.values.password || ''}
            onChange={form.handleChange('password')}
            onBlur={form.handleBlur('password')}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            dir="ltr"
            aria-invalid={form.errors.password ? true : undefined}
            aria-describedby={form.errors.password ? 'login-password-error' : undefined}
          />
          {form.errors.password && (
            <p id="login-password-error" className="mt-1 text-xs text-destructive" aria-live="polite">
              {form.errors.password}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {loading ? t('submitting') : t('submit')}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{t('orContinueWith')}</span>
        </div>
      </div>

      {/* Google Sign-In */}
      <GoogleSignInButton text="signin_with" />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link href="/register" className="text-primary hover:underline font-medium">
          {t('signUp')}
        </Link>
      </p>
    </div>
  );
}
