'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  const t = useTranslations('auth.verifyEmail');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }

    const verify = async () => {
      try {
        await api.post('/auth/verify-email', { token });
        setStatus('success');
      } catch {
        setStatus('error');
      }
    };

    verify();
  }, [token]);

  const handleResend = useCallback(async () => {
    setResendStatus('sending');
    try {
      await api.post('/auth/resend-verification');
      setResendStatus('sent');
    } catch {
      setResendStatus('error');
    }
  }, []);

  return (
    <div className="rounded-xl border bg-card p-8 shadow-sm">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold">{t('title')}</h1>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">{t('verifying')}</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="mb-4 rounded-lg bg-primary/10 p-4 text-sm text-primary">
              {t('success')}
            </div>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              {t('goToLogin')}
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="mb-4 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              {t('failed')}
            </div>
            <div className="flex flex-col items-center gap-3">
              <Link href="/login" className="text-sm font-medium text-primary hover:underline">
                {t('goToLogin')}
              </Link>

              <div className="mt-2 border-t pt-3 w-full">
                <p className="mb-3 text-sm text-muted-foreground">{t('resendDescription')}</p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendStatus === 'sending' || resendStatus === 'sent'}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resendStatus === 'sending' && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  {t('resendButton')}
                </button>
                {resendStatus === 'sent' && (
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                    {t('resendSuccess')}
                  </p>
                )}
                {resendStatus === 'error' && (
                  <p className="mt-2 text-sm text-destructive">{t('resendError')}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {status === 'no-token' && (
          <div>
            <div className="mb-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-4 text-sm text-yellow-800 dark:text-yellow-300">
              {t('noToken')}
            </div>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              {t('goToLogin')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
