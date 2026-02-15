'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface SiteSettings {
  siteName: string;
  logoUrl: string | null;
  primaryColor: string;
}

export function Header() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['public', 'site-settings'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/public/site-settings`);
      return data.data as SiteSettings;
    },
    staleTime: 5 * 60 * 1000,
  });

  const siteName = settings?.siteName || 'Mojeeb';
  const logoUrl = settings?.logoUrl;
  const initial = siteName.charAt(0).toUpperCase();

  const navItems = [
    { href: '/', label: t('home') },
    { href: '/features', label: t('features') },
    { href: '/pricing', label: t('pricing') },
    { href: '/contact', label: t('contact') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
              {initial}
            </div>
          )}
          <span className="text-xl font-bold">{siteName}</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LanguageSwitcher />
          <Link
            href="/login"
            className="hidden md:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t('login')}
          </Link>
          <Link
            href="/register"
            className="hidden md:inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('register')}
          </Link>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-background p-4">
          <nav className="flex flex-col gap-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground hover:text-primary"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <hr />
            <Link href="/login" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>
              {t('login')}
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
              onClick={() => setMobileOpen(false)}
            >
              {t('register')}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
