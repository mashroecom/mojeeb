'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Megaphone, ShieldAlert, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: 'INFO' | 'WARNING' | 'CRITICAL' | string;
}

const QUERY_KEY = ['announcements', 'active'] as const;

const STYLES: Record<string, { box: string; icon: string; title: string; body: string }> = {
  INFO: {
    box: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-900 dark:text-blue-100',
    body: 'text-blue-700 dark:text-blue-300',
  },
  WARNING: {
    box: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
    icon: 'text-amber-600 dark:text-amber-400',
    title: 'text-amber-900 dark:text-amber-100',
    body: 'text-amber-700 dark:text-amber-300',
  },
  CRITICAL: {
    box: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
    icon: 'text-red-600 dark:text-red-400',
    title: 'text-red-900 dark:text-red-100',
    body: 'text-red-700 dark:text-red-300',
  },
};

const ICONS = { INFO: Megaphone, WARNING: AlertTriangle, CRITICAL: ShieldAlert } as const;

/**
 * Shows the platform announcements published by admins (Admin → Announcements)
 * at the top of the dashboard. Dismissals are stored per user on the server.
 */
export function AnnouncementBanner() {
  const t = useTranslations('common');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const { data: announcements } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get('/announcements');
      return data.data as Announcement[];
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/announcements/${id}/dismiss`);
    },
    onMutate: async (id) => {
      // Hide immediately; the server call only makes it stick across devices
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      queryClient.setQueryData<Announcement[]>(QUERY_KEY, (prev) =>
        (prev ?? []).filter((a) => a.id !== id),
      );
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  if (!announcements || announcements.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {announcements.map((announcement) => {
        const style = STYLES[announcement.type] ?? STYLES.INFO;
        const Icon = ICONS[announcement.type as keyof typeof ICONS] ?? Megaphone;
        return (
          <div
            key={announcement.id}
            role={announcement.type === 'CRITICAL' ? 'alert' : 'status'}
            className={cn('flex items-start justify-between gap-3 rounded-lg border p-4', style.box)}
          >
            <div className="flex min-w-0 items-start gap-3">
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.icon)} aria-hidden="true" />
              <div className="min-w-0">
                <p className={cn('text-sm font-medium', style.title)}>{announcement.title}</p>
                <p className={cn('mt-0.5 whitespace-pre-line break-words text-xs', style.body)}>
                  {announcement.body}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismiss.mutate(announcement.id)}
              aria-label={t('close')}
              className={cn('shrink-0 rounded p-1 opacity-70 hover:opacity-100', style.icon)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
