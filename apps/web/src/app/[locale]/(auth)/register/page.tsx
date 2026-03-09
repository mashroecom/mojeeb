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
import { registerSchema } from '@mojeeb/shared-utils';

export default function RegisterPage() {
  const t = useTranslations('auth.register');
  const tLogin = useTranslations('auth.login');
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const form = useZodForm({
    schema: registerSchema,
    initialValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      organizationName: '',
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
      const response = await api.post('/auth/register', form.values);
      const { tokens, user, organization, organizations } = response.data.data;

      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      setAuthCookie(tokens.accessToken);
      setOnboardingCookie(false); // new user always needs onboarding

      if (user && organization) {
        // Force onboardingCompleted to false — this is a new registration
        setAuth({ ...user, onboardingCompleted: false }, organization, organizations);
      }

      router.push('/onboarding');
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.details?.body?.fieldErrors) {
        const fieldErrors = data.details.body.fieldErrors as Record<string, string[]>;
        const msgs = Object.values(fieldErrors).flat();
        setError(msgs.join(', '));
      } else {
        const msg = data?.error || '';
        if (msg.includes('already registered')) setError(t('emailAlreadyRegistered'));
        else setError(t('registrationFailed'));
      }
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
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="reg-firstName" className="mb-1.5 block text-sm font-medium">{t('firstName')}</label>
            <input
              id="reg-firstName"
              type="text"
              value={form.values.firstName || ''}
              onChange={form.handleChange('firstName')}
              onBlur={form.handleBlur('firstName')}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            {form.errors.firstName && (
              <p className="mt-1 text-xs text-destructive">{form.errors.firstName}</p>
            )}
          </div>
          <div>
            <label htmlFor="reg-lastName" className="mb-1.5 block text-sm font-medium">{t('lastName')}</label>
            <input
              id="reg-lastName"
              type="text"
              value={form.values.lastName || ''}
              onChange={form.handleChange('lastName')}
              onBlur={form.handleBlur('lastName')}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            {form.errors.lastName && (
              <p className="mt-1 text-xs text-destructive">{form.errors.lastName}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="reg-orgName" className="mb-1.5 block text-sm font-medium">{t('organizationName')}</label>
          <input
            id="reg-orgName"
            type="text"
            value={form.values.organizationName || ''}
            onChange={form.handleChange('organizationName')}
            onBlur={form.handleBlur('organizationName')}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {form.errors.organizationName && (
            <p className="mt-1 text-xs text-destructive">{form.errors.organizationName}</p>
          )}
        </div>

        <div>
          <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium">{t('email')}</label>
          <input
            id="reg-email"
            type="email"
            value={form.values.email || ''}
            onChange={form.handleChange('email')}
            onBlur={form.handleBlur('email')}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            placeholder="name@company.com"
            dir="ltr"
          />
          {form.errors.email && (
            <p className="mt-1 text-xs text-destructive">{form.errors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="reg-password" className="mb-1.5 block text-sm font-medium">{t('password')}</label>
          <input
            id="reg-password"
            type="password"
            value={form.values.password || ''}
            onChange={form.handleChange('password')}
            onBlur={form.handleBlur('password')}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            dir="ltr"
          />
          {form.errors.password && (
            <p className="mt-1 text-xs text-destructive">{form.errors.password}</p>
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
          <span className="bg-card px-2 text-muted-foreground">{tLogin('orContinueWith')}</span>
        </div>
      </div>

      {/* Google Sign-In */}
      <GoogleSignInButton text="signup_with" />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('hasAccount')}{' '}
        <Link href="/login" className="text-primary hover:underline font-medium">
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
