'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NotificationBell } from './NotificationBell';
import { useSidebar } from './SidebarContext';
import { useDashboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Menu, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';

const PAGE_TITLE_KEYS: Record<string, string> = {
  dashboard: 'overview',
  conversations: 'conversations',
  agents: 'agents',
  'knowledge-base': 'knowledgeBase',
  'message-templates': 'messageTemplates',
  analytics: 'analytics',
  leads: 'leads',
  billing: 'billing',
  settings: 'settings',
  team: 'team',
  'api-keys': 'apiKeys',
  webhooks: 'webhooks',
};

export function DashboardTopbar() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('dashboard.sidebar');
  const tc = useTranslations('common');
  const siteName = tc('appName');
  const { toggle, isOpen: sidebarOpen } = useSidebar();

  // Enable global keyboard shortcuts
  useDashboardShortcuts();

  // Build breadcrumb segments
  const segments = pathname.split('/').filter(Boolean);
  const pageSegments = segments[0] === locale ? segments.slice(1) : segments;

  useEffect(() => {
    const pageKey = pageSegments[0] ?? 'dashboard';
    const translationKey = PAGE_TITLE_KEYS[pageKey];

    if (translationKey) {
      try {
        const pageTitle = t(translationKey);
        document.title = `${pageTitle} | ${siteName}`;
      } catch {
        document.title = siteName;
      }
    } else {
      document.title = siteName;
    }
  }, [pathname, locale, siteName, t, pageSegments]);

  // Build breadcrumb items
  const breadcrumbs = pageSegments
    .map((segment, index) => {
      const translationKey = PAGE_TITLE_KEYS[segment];
      const label = translationKey
        ? (() => {
            try {
              return t(translationKey);
            } catch {
              return segment;
            }
          })()
        : segment;
      const href = '/' + pageSegments.slice(0, index + 1).join('/');
      return { label, href };
    })
    .filter((b) => b.label);

  return (
    <header
      role="banner"
      className="flex h-14 md:h-16 items-center justify-between border-b bg-card px-4 md:px-6"
    >
      {/* Hamburger menu + Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={toggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
          aria-label={t('toggleMenu')}
          aria-expanded={sidebarOpen}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumbs (desktop only) */}
        {breadcrumbs.length > 0 && (
          <nav className="hidden md:flex items-center gap-1 text-sm text-muted-foreground min-w-0">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" />}
                {i === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-foreground truncate">{crumb.label}</span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="hover:text-foreground transition-colors truncate"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        <LanguageSwitcher />
        <NotificationBell />
      </div>
    </header>
  );
}
