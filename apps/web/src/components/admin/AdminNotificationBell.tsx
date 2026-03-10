'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import { Bell } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  useAdminNotifications,
  useAdminUnreadCount,
  useMarkNotificationRead,
} from '@/hooks/useAdmin';
import { cn } from '@/lib/utils';

export function AdminNotificationBell() {
  const locale = useLocale();
  const t = useTranslations('admin.common');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: unreadData } = useAdminUnreadCount();
  const { data: notificationsData } = useAdminNotifications({
    page: 1,
    limit: 5,
    unreadOnly: false,
  });
  const markRead = useMarkNotificationRead();

  const unreadCount = unreadData?.count ?? 0;
  const notifications = notificationsData?.notifications ?? notificationsData?.data ?? [];

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-80 rounded-lg border bg-card shadow-lg z-50">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-medium">{t('notifications')}</span>
            <Link
              href="/admin/notifications"
              className="text-xs text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              {t('viewAll')}
            </Link>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('noNotifications')}
              </p>
            ) : (
              notifications.map((n: any) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.isRead) markRead.mutate(n.id);
                  }}
                  className={cn(
                    'block w-full text-start px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors',
                    !n.isRead && 'bg-primary/5',
                  )}
                >
                  <p className={cn('text-sm', !n.isRead && 'font-medium')}>{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {fmtDateTime(n.createdAt, locale)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
