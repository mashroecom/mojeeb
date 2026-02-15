'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { api } from '@/lib/api';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useSidebar } from './SidebarContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  BookOpen,
  Share2,
  Radio,
  Users,
  BarChart3,
  CreditCard,
  Settings,
  LogOut,
  User,
  ChevronUp,
  Key,
  Building2,
  ChevronsUpDown,
  Check,
  X,
  ShieldCheck,
  Webhook,
  FileText,
} from 'lucide-react';

const sidebarItems = [
  { key: 'overview', href: '/dashboard', icon: LayoutDashboard },
  { key: 'conversations', href: '/conversations', icon: MessageSquare },
  { key: 'agents', href: '/agents', icon: Bot },
  { key: 'channels', href: '/channels', icon: Radio },
  { key: 'knowledgeBase', href: '/knowledge-base', icon: BookOpen },
  { key: 'messageTemplates', href: '/message-templates', icon: FileText },
  { key: 'leads', href: '/leads', icon: Users },
  { key: 'analytics', href: '/analytics', icon: BarChart3 },
  { key: 'team', href: '/team', icon: Users },
  { key: 'apiKeys', href: '/api-keys', icon: Key },
  { key: 'webhooks', href: '/webhooks', icon: Webhook },
  { key: 'billing', href: '/billing', icon: CreditCard },
  { key: 'settings', href: '/settings', icon: Settings },
] as const;

export function DashboardSidebar() {
  const t = useTranslations('dashboard.sidebar');
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, organization, organizations, clearAuth, switchOrganization } = useAuthStore();
  const { data: subscription } = useSubscription();
  const [showMenu, setShowMenu] = useState(false);
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { isOpen, close } = useSidebar();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const orgSwitcherRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (showMenu && userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
      if (showOrgSwitcher && orgSwitcherRef.current && !orgSwitcherRef.current.contains(e.target as Node)) {
        setShowOrgSwitcher(false);
      }
    }
    if (showMenu || showOrgSwitcher) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu, showOrgSwitcher]);

  const displayName = user
    ? `${user.firstName} ${user.lastName}`
    : 'User';
  const initials = user
    ? `${user.firstName[0] || ''}${user.lastName[0] || ''}`
    : 'U';

  // Close sidebar on route change (mobile)
  useEffect(() => {
    close();
  }, [pathname, close]);

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

  const handleSwitchOrg = async (org: { id: string; name: string; slug: string }) => {
    switchOrganization(org);
    setShowOrgSwitcher(false);
    queryClient.clear();
    router.push('/dashboard');
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        role="navigation"
        aria-label={t('sidebarNav')}
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-64 flex-col border-e bg-card transition-transform duration-300 md:static md:translate-x-0 md:rtl:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full',
        )}
      >
        {/* Logo + mobile close */}
        <div className="flex h-16 items-center justify-between border-b px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
              M
            </div>
            <span className="text-lg font-bold">Mojeeb</span>
          </div>
          <button
            type="button"
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary md:hidden"
            aria-label={t('closeSidebar')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Organization Switcher */}
        {organizations.length > 1 && (
          <div className="border-b p-3 relative" ref={orgSwitcherRef}>
            <button
              type="button"
              onClick={() => setShowOrgSwitcher(!showOrgSwitcher)}
              className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
              aria-label={t('switchOrg')}
              aria-expanded={showOrgSwitcher}
              aria-haspopup="listbox"
            >
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-start font-medium">
                {organization?.name}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>

            {showOrgSwitcher && (
              <div className="absolute start-3 end-3 top-full z-50 mt-1 rounded-lg border bg-card shadow-lg">
                <div className="p-1">
                  <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t('switchOrg')}
                  </p>
                  {organizations.map((membership) => (
                    <button
                      key={membership.org.id}
                      type="button"
                      onClick={() => handleSwitchOrg(membership.org)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                        organization?.id === membership.org.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-accent',
                      )}
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate text-start">{membership.org.name}</span>
                      <span className="text-xs text-muted-foreground">{membership.role}</span>
                      {organization?.id === membership.org.id && (
                        <Check className="h-3.5 w-3.5 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{t(item.key)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Super Admin link */}
        {user?.isSuperAdmin && (
          <div className="px-3 pb-1">
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>{t('adminPanel')}</span>
            </Link>
          </div>
        )}

        {/* Theme toggle */}
        <div className="px-3 pb-2">
          <ThemeToggle />
        </div>

        {/* User section */}
        <div className="border-t p-3 relative" ref={userMenuRef}>
          {/* Dropdown menu */}
          {showMenu && (
            <div className="absolute bottom-full start-3 end-3 mb-1 rounded-lg border bg-card shadow-lg">
              <div className="p-1">
                <Link
                  href="/settings"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <User className="h-4 w-4" />
                  {t('profile')}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  {t('logout')}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            aria-label={t('userMenu')}
            aria-expanded={showMenu}
            aria-haspopup="menu"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
              {initials}
            </div>
            <div className="flex-1 truncate text-start">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {subscription ? t(`plan_${subscription.plan}` as any) : t('freePlan')}
              </p>
            </div>
            <ChevronUp
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                !showMenu && 'rotate-180',
              )}
            />
          </button>
        </div>
      </aside>
    </>
  );
}
