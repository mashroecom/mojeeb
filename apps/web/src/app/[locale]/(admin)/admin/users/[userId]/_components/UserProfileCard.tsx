'use client';

import { useTranslations, useLocale } from 'next-intl';
import { fmtDate, fmtDateTime } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';
import {
  User,
  Mail,
  Calendar,
  Clock,
  UserCheck,
  UserX,
  Shield,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface UserProfileCardProps {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string | null;
    createdAt: string;
    lastLoginAt?: string | null;
    suspendedAt?: string | null;
    isSuperAdmin: boolean;
    emailVerified: boolean;
  };
  isSuspended: boolean;
}

export function UserProfileCard({ user, isSuspended }: UserProfileCardProps) {
  const t = useTranslations('admin');
  const locale = useLocale();

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex flex-col items-center text-center">
        {/* Avatar */}
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={`${user.firstName} ${user.lastName}`}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <User className="h-10 w-10 text-primary" />
          )}
        </div>

        <p className="text-xs text-muted-foreground font-mono select-all">{user.id}</p>
        <h2 className="text-lg font-semibold mt-1">
          {user.firstName} {user.lastName}
        </h2>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
          <Mail className="h-3.5 w-3.5" />
          {user.email}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
          {/* Status badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
              isSuspended
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            )}
          >
            {isSuspended ? (
              <UserX className="h-3 w-3" />
            ) : (
              <UserCheck className="h-3 w-3" />
            )}
            {isSuspended ? t('users.suspended') : t('users.active')}
          </span>

          {/* Super Admin badge */}
          {user.isSuperAdmin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 py-0.5 text-xs font-medium">
              <Shield className="h-3 w-3" />
              {t('userDetail.superAdmin')}
            </span>
          )}

          {/* Email verified badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
              user.emailVerified
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
            )}
          >
            {user.emailVerified ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            {user.emailVerified
              ? t('userDetail.emailVerified')
              : t('userDetail.emailNotVerified')}
          </span>
        </div>
      </div>

      {/* Info rows */}
      <div className="mt-5 pt-5 border-t space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {t('userDetail.joined')}
          </span>
          <span className="font-medium">{fmtDate(user.createdAt, locale)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {t('userDetail.lastLogin')}
          </span>
          <span className="font-medium">{user.lastLoginAt ? fmtDateTime(user.lastLoginAt, locale) : '—'}</span>
        </div>
        {isSuspended && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-red-500">
              <UserX className="h-3.5 w-3.5" />
              {t('userDetail.suspendedAt')}
            </span>
            <span className="font-medium text-red-500">
              {user.suspendedAt ? fmtDate(user.suspendedAt, locale) : '—'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
