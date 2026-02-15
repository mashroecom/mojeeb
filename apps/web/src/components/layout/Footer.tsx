'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('nav');

  const { data: settings } = useQuery({
    queryKey: ['public', 'site-settings'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/public/site-settings`);
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const siteName = settings?.siteName || 'Mojeeb';
  const logoUrl = settings?.logoUrl;
  const initial = siteName.charAt(0).toUpperCase();

  return (
    <footer className="border-t bg-muted/50">
      <div className="container py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-8 w-8 rounded-lg object-contain" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                  {initial}
                </div>
              )}
              <span className="text-xl font-bold">{siteName}</span>
            </div>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold mb-3">{t('product')}</h3>
            <ul className="space-y-2">
              <li><Link href="/features" className="text-sm text-muted-foreground hover:text-foreground">{tNav('features')}</Link></li>
              <li><Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">{tNav('pricing')}</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold mb-3">{t('company')}</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-sm text-muted-foreground hover:text-foreground">{t('about')}</Link></li>
              <li><Link href="/careers" className="text-sm text-muted-foreground hover:text-foreground">{t('careers')}</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold mb-3">{t('legal')}</h3>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">{t('privacy')}</Link></li>
              <li><Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">{t('terms')}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {siteName}. {t('copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
}
