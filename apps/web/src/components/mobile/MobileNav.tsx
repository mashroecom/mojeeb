'use client';

import { usePathname } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { MessageSquare, BarChart3, User, Circle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAgents, useUpdateAgent } from '@/hooks/useAgents';
import { useToastStore } from '@/hooks/useToast';
import { useState } from 'react';

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
  const { data: agents, isLoading } = useAgents();
  const updateAgent = useUpdateAgent();
  const addToast = useToastStore((s) => s.addToast);
  const [isToggling, setIsToggling] = useState(false);

  // Get the first agent (primary agent)
  const primaryAgent = agents?.[0];

  const handleToggleStatus = async () => {
    if (!primaryAgent || isToggling) return;

    setIsToggling(true);
    const newStatus = !primaryAgent.isActive;

    updateAgent.mutate(
      { id: primaryAgent.id, isActive: newStatus },
      {
        onSuccess: () => {
          addToast(
            'success',
            newStatus ? t('agentActivated') : t('agentDeactivated'),
          );
          setIsToggling(false);
        },
        onError: () => {
          addToast('error', t('agentUpdateError'));
          setIsToggling(false);
        },
      },
    );
  };

  return (
    <nav className="fixed bottom-0 start-0 end-0 z-50 border-t bg-card shadow-lg safe-area-inset-bottom">
      {/* Agent Status Bar */}
      {!isLoading && primaryAgent && (
        <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <Circle
              className={cn(
                'h-2.5 w-2.5 fill-current',
                primaryAgent.isActive
                  ? 'text-green-500'
                  : 'text-muted-foreground',
              )}
            />
            <span className="text-xs font-medium">
              {primaryAgent.name}
            </span>
          </div>
          <button
            onClick={handleToggleStatus}
            disabled={isToggling}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50',
              primaryAgent.isActive
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {isToggling
              ? t('updating')
              : primaryAgent.isActive
                ? t('active')
                : t('inactive')}
          </button>
        </div>
      )}

      {/* Bottom Navigation */}
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
