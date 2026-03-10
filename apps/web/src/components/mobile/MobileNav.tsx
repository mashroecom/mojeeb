'use client';

import { usePathname } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { MessageSquare, BarChart3, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { key: 'inbox', href: '/mobile/inbox', icon: MessageSquare },
  { key: 'analytics', href: '/mobile/analytics', icon: BarChart3 },
  { key: 'profile', href: '/mobile/profile', icon: User },
];

export function MobileNav() {
  const t = useTranslations('mobile.nav');
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 start-0 end-0 z-50 border-t bg-card shadow-lg safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/mobile'
              ? pathname === '/mobile'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-lg px-4 py-2 min-w-[70px] transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 transition-transform',
                  isActive && 'scale-110',
                )}
              />
              <span className="text-xs font-medium">{t(item.key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
