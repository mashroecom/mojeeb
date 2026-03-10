'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Phone, CheckCircle, Building2, User, Mail, MessageSquare } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function RequestDemoPage() {
  const t = useTranslations('landing.requestDemo');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/demo-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        throw new Error('submit failed');
      }

      setSent(true);
    } catch {
      setError(t('submitError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-20">
      <div className="container max-w-2xl">
        <div className="text-center mb-10">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Phone className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>

        {sent ? (
          <div className="rounded-xl border bg-card p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold">{t('successTitle')}</h3>
            <p className="mt-3 text-muted-foreground">{t('successDescription')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-card p-6 sm:p-8">
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              {/* Name */}
              <div>
                <label
                  htmlFor="demo-name"
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('name')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="demo-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder={t('namePlaceholder')}
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="demo-email"
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"
                >
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('email')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="demo-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  dir="ltr"
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {/* Phone */}
              <div>
                <label
                  htmlFor="demo-phone"
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"
                >
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('phone')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="demo-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                  dir="ltr"
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="+XX XXX XXX XXXX"
                />
              </div>

              {/* Company */}
              <div>
                <label
                  htmlFor="demo-company"
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"
                >
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('company')}
                </label>
                <input
                  id="demo-company"
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder={t('companyPlaceholder')}
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="demo-message"
                className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"
              >
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                {t('message')}
              </label>
              <textarea
                id="demo-message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={3}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none"
                placeholder={t('messagePlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {loading ? t('submitting') : t('submit')}
            </button>

            <p className="text-center text-xs text-muted-foreground">{t('note')}</p>
          </form>
        )}
      </div>
    </section>
  );
}
