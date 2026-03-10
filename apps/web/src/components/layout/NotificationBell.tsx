'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { fmtDate } from '@/lib/dateFormat';
import {
  Bell,
  MessageSquarePlus,
  ArrowRightLeft,
  UserPlus,
  AlertTriangle,
  Info,
  Check,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from '@/hooks/useNotifications';
import type { Notification } from '@/hooks/useNotifications';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNotificationIcon(type: string) {
  switch (type) {
    case 'CONVERSATION_NEW':
      return <MessageSquarePlus className="h-4 w-4 text-blue-500" />;
    case 'CONVERSATION_HANDOFF':
      return <ArrowRightLeft className="h-4 w-4 text-orange-500" />;
    case 'LEAD_NEW':
      return <UserPlus className="h-4 w-4 text-green-500" />;
    case 'USAGE_WARNING':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'SYSTEM':
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatRelativeTime(
  dateStr: string,
  locale: string,
  t: (key: string, values?: Record<string, number>) => string,
): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return t('justNow');
  if (diffMin < 60) return t('minutesAgo', { count: diffMin });
  if (diffHour < 24) return t('hoursAgo', { count: diffHour });
  if (diffDay < 7) return t('daysAgo', { count: diffDay });
  return fmtDate(dateStr, locale);
}

// ---------------------------------------------------------------------------
// Notification Item
// ---------------------------------------------------------------------------

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  onNavigate,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (notification: Notification) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('notifications');
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer border-b last:border-b-0',
        !notification.isRead && 'bg-accent/30',
      )}
      onClick={() => {
        if (!notification.isRead) {
          onMarkRead(notification.id);
        }
        onNavigate(notification);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          if (!notification.isRead) onMarkRead(notification.id);
          onNavigate(notification);
        }
      }}
    >
      {/* Type icon */}
      <div className="mt-0.5 shrink-0">{getNotificationIcon(notification.type)}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'text-sm truncate',
              !notification.isRead ? 'font-semibold' : 'font-medium',
            )}
          >
            {notification.title}
          </p>
          {!notification.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notification.body}</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {formatRelativeTime(notification.createdAt, locale, t)}
        </p>
      </div>

      {/* Actions */}
      <button
        className="mt-0.5 shrink-0 rounded p-1 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
        title={t('deleteNotification')}
        aria-label={t('deleteNotification')}
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NotificationBell
// ---------------------------------------------------------------------------

export function NotificationBell() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: notificationsData } = useNotifications({ limit: 20 });
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();

  const notifications = notificationsData?.data ?? [];

  const handleNavigate = (notification: Notification) => {
    const convId = notification.metadata?.conversationId;
    if (convId) {
      setIsOpen(false);
      router.push(`/${locale}/conversations?id=${convId}`);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        className="relative rounded-lg p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t('bellAriaLabel')}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1 end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute end-0 top-full mt-2 w-96 rounded-lg border bg-card shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">{t('title')}</h3>
            {unreadCount > 0 && (
              <button
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
              >
                <Check className="h-3 w-3" />
                {t('markAllRead')}
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">{t('empty')}</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={(id) => markAsRead.mutate(id)}
                  onDelete={(id) => deleteNotification.mutate(id)}
                  onNavigate={handleNavigate}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
