'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  Loader2,
  UserCheck,
  UserX,
  Trash2,
  Shield,
  ShieldOff,
  KeyRound,
  Send,
  UserCog,
  Pencil,
  BadgeCheck,
} from 'lucide-react';

interface UserActionsBarProps {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    isSuperAdmin: boolean;
    suspendedAt: string | null;
  };
  userId: string;
  isSuspended: boolean;
  // Mutation states
  verifyEmailIsPending: boolean;
  toggleSuperAdminIsPending: boolean;
  resetPasswordIsPending: boolean;
  impersonateUserIsPending: boolean;
  toggleSuspensionIsPending: boolean;
  deleteUserIsPending: boolean;
  // Handlers
  onEditProfile: () => void;
  onVerifyEmail: () => void;
  onToggleSuperAdmin: () => void;
  onResetPassword: () => void;
  onSendEmail: () => void;
  onImpersonate: () => void;
  onToggleSuspension: () => void;
  onDelete: () => void;
}

export function UserActionsBar({
  user,
  userId,
  isSuspended,
  verifyEmailIsPending,
  toggleSuperAdminIsPending,
  resetPasswordIsPending,
  impersonateUserIsPending,
  toggleSuspensionIsPending,
  deleteUserIsPending,
  onEditProfile,
  onVerifyEmail,
  onToggleSuperAdmin,
  onResetPassword,
  onSendEmail,
  onImpersonate,
  onToggleSuspension,
  onDelete,
}: UserActionsBarProps) {
  const t = useTranslations('admin');

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex flex-col gap-2">
        {/* Edit Profile */}
        <button
          onClick={onEditProfile}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 px-3 py-2 text-sm font-medium transition-colors w-full"
        >
          <Pencil className="h-4 w-4" />
          {t('userActions.editProfile')}
        </button>

        {/* Verify Email */}
        <button
          onClick={onVerifyEmail}
          disabled={verifyEmailIsPending}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors w-full',
            user.emailVerified
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              : 'bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50',
          )}
        >
          <BadgeCheck className="h-4 w-4" />
          {user.emailVerified ? t('userActions.unverifyEmail') : t('userActions.verifyEmail')}
        </button>

        <hr className="my-1" />

        {/* Toggle Super Admin */}
        <button
          onClick={onToggleSuperAdmin}
          disabled={toggleSuperAdminIsPending}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 px-3 py-2 text-sm font-medium transition-colors w-full"
        >
          {user.isSuperAdmin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
          {user.isSuperAdmin ? t('userActions.removeSuperAdmin') : t('userActions.makeSuperAdmin')}
        </button>

        {/* Reset Password */}
        <button
          onClick={onResetPassword}
          disabled={resetPasswordIsPending}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-3 py-2 text-sm font-medium transition-colors w-full"
        >
          {resetPasswordIsPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          {t('userActions.resetPassword')}
        </button>

        {/* Send Email */}
        <button
          onClick={onSendEmail}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 px-3 py-2 text-sm font-medium transition-colors w-full"
        >
          <Send className="h-4 w-4" />
          {t('userActions.sendEmail')}
        </button>

        {/* Impersonate */}
        <button
          onClick={onImpersonate}
          disabled={impersonateUserIsPending}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50 px-3 py-2 text-sm font-medium transition-colors w-full"
        >
          {impersonateUserIsPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserCog className="h-4 w-4" />
          )}
          {t('userActions.impersonate')}
        </button>

        <hr className="my-1" />

        {/* Suspend / Activate */}
        <button
          onClick={onToggleSuspension}
          disabled={toggleSuspensionIsPending}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors w-full',
            isSuspended
              ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
              : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50',
          )}
        >
          {isSuspended ? (
            <>
              <UserCheck className="h-4 w-4" />
              {t('users.activate')}
            </>
          ) : (
            <>
              <UserX className="h-4 w-4" />
              {t('users.suspend')}
            </>
          )}
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          disabled={deleteUserIsPending}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-3 py-2 text-sm font-medium transition-colors w-full"
        >
          <Trash2 className="h-4 w-4" />
          {t('users.delete')}
        </button>
      </div>
    </div>
  );
}
