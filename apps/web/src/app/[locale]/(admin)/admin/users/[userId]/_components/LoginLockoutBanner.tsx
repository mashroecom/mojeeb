'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock, LockOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { useToastStore } from '@/hooks/useToast';

interface LockState {
  locked: boolean;
  retryAfterSeconds: number;
}

/**
 * Shown only while the account is locked after too many failed sign-ins (admin settings
 * "Max login attempts" / "Lockout duration"). Lets an admin lift the lock early.
 */
export function LoginLockoutBanner({ userId }: { userId: string }) {
  const t = useTranslations('admin.userActions');
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'users', userId, 'lockout'] as const;

  const { data } = useQuery({
    queryKey,
    queryFn: async (): Promise<LockState> => {
      const res = await api.get(`/admin/users/${userId}/lockout`);
      return res.data.data;
    },
    refetchInterval: (query) => (query.state.data?.locked ? 30_000 : false),
  });

  const unlock = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/users/${userId}/unlock`);
    },
    onSuccess: () => {
      queryClient.setQueryData<LockState>(queryKey, { locked: false, retryAfterSeconds: 0 });
      addToast('success', t('unlockSuccess'));
    },
    onError: () => addToast('error', t('unlockFailed')),
  });

  if (!data?.locked) return null;

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10"
    >
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {t('lockedTitle')}
          </p>
          <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
            {t('lockedDescription', {
              minutes: Math.max(1, Math.ceil(data.retryAfterSeconds / 60)),
            })}
          </p>
          <button
            type="button"
            onClick={() => unlock.mutate()}
            disabled={unlock.isPending}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {unlock.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LockOpen className="h-3.5 w-3.5" />
            )}
            {t('unlock')}
          </button>
        </div>
      </div>
    </div>
  );
}
