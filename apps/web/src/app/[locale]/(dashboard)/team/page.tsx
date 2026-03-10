'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { fmtDate } from '@/lib/dateFormat';
import {
  useOrgMembers,
  useInviteMember,
  useUpdateMemberRole,
  useRemoveMember,
  useTransferOwnership,
} from '@/hooks/useOrganization';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  Users,
  Loader2,
  CheckCircle,
  Plus,
  Mail,
  Shield,
  ShieldCheck,
  Crown,
  UserMinus,
  ArrowRightLeft,
  AlertTriangle,
  Info,
  Grid3X3,
  UserPlus,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

const inputClass =
  'h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

const selectClass =
  'h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

export default function TeamPage() {
  const t = useTranslations('dashboard.team');
  const tc = useTranslations('common');
  const ts = useTranslations('dashboard.sidebar');
  const tb = useTranslations('dashboard.breadcrumb');
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);

  // Members
  const { data: members, isLoading: membersLoading, error: membersError, refetch: refetchMembers } = useOrgMembers();
  const inviteMember = useInviteMember();
  const updateMemberRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const transferOwnership = useTransferOwnership();
  const { confirmProps, confirm } = useConfirmDialog();

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [inviteErrorMsg, setInviteErrorMsg] = useState('');

  // Derive current user's role from the members list
  const currentMember = members?.find((m) => m.user.id === user?.id);
  const currentRole = currentMember?.role ?? 'MEMBER';
  const isOwner = currentRole === 'OWNER';
  const isAdmin = currentRole === 'ADMIN';
  const canManageMembers = isOwner || isAdmin;

  return (
    <>
      <div>
        <Breadcrumb
          items={[{ label: tb('dashboard'), href: '/dashboard' }, { label: ts('team') }]}
          className="mb-4"
        />

        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>

        <div className="mx-auto max-w-3xl space-y-6">
          {/* Invite Member Form */}
          {canManageMembers && (
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                {t('inviteTitle')}
              </h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                <div className="flex-1 w-full">
                  <label
                    htmlFor="inviteEmail"
                    className="block text-xs font-medium text-muted-foreground mb-1"
                  >
                    {t('email')}
                  </label>
                  <input
                    id="inviteEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value);
                      setInviteStatus('idle');
                    }}
                    placeholder={t('emailPlaceholder')}
                    className={inputClass}
                    dir="ltr"
                  />
                </div>
                <div className="w-full sm:w-36">
                  <label
                    htmlFor="inviteRole"
                    className="block text-xs font-medium text-muted-foreground mb-1"
                  >
                    {t('role')}
                  </label>
                  <select
                    id="inviteRole"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER')}
                    className={selectClass}
                  >
                    <option value="ADMIN">{t('admin')}</option>
                    <option value="MEMBER">{t('member')}</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={inviteMember.isPending || !inviteEmail.trim()}
                  onClick={() => {
                    inviteMember.mutate(
                      { email: inviteEmail.trim(), role: inviteRole },
                      {
                        onSuccess: () => {
                          setInviteEmail('');
                          setInviteStatus('success');
                          setTimeout(() => setInviteStatus('idle'), 3000);
                          toast.success(tc('toast.inviteSent'));
                        },
                        onError: (err: any) => {
                          const raw = err?.response?.data?.error ?? '';
                          const msg = raw.includes('limit reached')
                            ? t('memberLimitReached')
                            : raw || t('inviteError');
                          setInviteStatus('error');
                          setTimeout(() => setInviteStatus('idle'), 5000);
                          toast.error(tc('toast.inviteFailed'));
                        },
                      },
                    );
                  }}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                    (inviteMember.isPending || !inviteEmail.trim()) &&
                      'cursor-not-allowed opacity-50',
                  )}
                >
                  {inviteMember.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {t('invite')}
                </button>
              </div>
              {inviteStatus === 'success' && (
                <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {t('inviteSuccess')}
                </p>
              )}
              {inviteStatus === 'error' && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {inviteErrorMsg || t('inviteError')}
                </p>
              )}
            </div>
          )}

          {/* Members Table */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              {t('members')}
              {members && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({members.length})
                </span>
              )}
            </h2>

            {membersError ? (
              <ErrorState
                title={t('errorTitle') || 'Failed to load team members'}
                description={t('errorDescription') || 'An error occurred while loading team members. Please try again.'}
                retryLabel={tc('retry') || 'Try Again'}
                onRetry={() => refetchMembers()}
              />
            ) : membersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton variant="circle" className="h-8 w-8" />
                    <div className="flex-1 space-y-2">
                      <Skeleton variant="text" className="w-32" />
                      <Skeleton variant="text" className="w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : members && members.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-2 text-start font-medium">{t('name')}</th>
                      <th className="pb-2 text-start font-medium">{t('email')}</th>
                      <th className="pb-2 text-start font-medium">{t('roleName')}</th>
                      <th className="pb-2 text-start font-medium">{t('joined')}</th>
                      {canManageMembers && (
                        <th className="pb-2 text-start font-medium">{t('actions')}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const isSelf = member.user.id === user?.id;
                      const isMemberOwner = member.role === 'OWNER';

                      const canChangeRole =
                        !isMemberOwner &&
                        !isSelf &&
                        (isOwner || (isAdmin && member.role === 'MEMBER'));

                      const canRemove = !isMemberOwner && !isSelf && canManageMembers;
                      const canTransfer = isOwner && !isSelf && !isMemberOwner;

                      return (
                        <tr key={member.id} className="border-b last:border-b-0">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                                {member.user.firstName[0]}
                                {member.user.lastName[0]}
                              </div>
                              <span className="font-medium">
                                {member.user.firstName} {member.user.lastName}
                                {isSelf && (
                                  <span className="text-xs text-muted-foreground ms-1">
                                    {t('you')}
                                  </span>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-muted-foreground" dir="ltr">
                            {member.user.email}
                          </td>
                          <td className="py-3">
                            {canChangeRole ? (
                              <select
                                value={member.role}
                                onChange={(e) => {
                                  const newRole = e.target.value as 'ADMIN' | 'MEMBER';
                                  if (newRole !== member.role) {
                                    updateMemberRole.mutate(
                                      {
                                        memberId: member.id,
                                        role: newRole,
                                      },
                                      {
                                        onSuccess: () => toast.success(tc('toast.roleUpdated')),
                                        onError: () => toast.error(tc('toast.roleUpdateFailed')),
                                      },
                                    );
                                  }
                                }}
                                disabled={updateMemberRole.isPending}
                                className={cn(
                                  'rounded-lg border bg-background px-2 py-1 text-xs outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary',
                                  updateMemberRole.isPending && 'opacity-50',
                                )}
                              >
                                <option value="ADMIN">{t('admin')}</option>
                                <option value="MEMBER">{t('member')}</option>
                              </select>
                            ) : (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                  member.role === 'OWNER' &&
                                    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
                                  member.role === 'ADMIN' &&
                                    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                                  member.role === 'MEMBER' && 'bg-muted text-muted-foreground',
                                )}
                              >
                                {member.role === 'OWNER' && <Crown className="h-3 w-3" />}
                                {member.role === 'ADMIN' && <ShieldCheck className="h-3 w-3" />}
                                {member.role === 'MEMBER' && <Shield className="h-3 w-3" />}
                                {member.role === 'OWNER'
                                  ? t('owner')
                                  : member.role === 'ADMIN'
                                    ? t('admin')
                                    : t('member')}
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {fmtDate(member.joinedAt, locale)}
                          </td>
                          {canManageMembers && (
                            <td className="py-3">
                              <div className="flex items-center gap-1">
                                {canTransfer && (
                                  <button
                                    type="button"
                                    title={t('transferOwnership')}
                                    disabled={transferOwnership.isPending}
                                    onClick={() => {
                                      confirm({
                                        title: t('transferOwnership'),
                                        message: t('transferConfirm'),
                                        confirmLabel: t('transferOwnership'),
                                        cancelLabel: t('cancel'),
                                        variant: 'danger',
                                        onConfirm: () => {
                                          transferOwnership.mutate(member.id, {
                                            onSuccess: () =>
                                              toast.success(tc('toast.ownershipTransferred')),
                                            onError: () =>
                                              toast.error(tc('toast.ownershipTransferFailed')),
                                          });
                                        },
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20 disabled:opacity-50"
                                  >
                                    <ArrowRightLeft className="h-3 w-3" />
                                  </button>
                                )}
                                {canRemove && (
                                  <button
                                    type="button"
                                    title={t('removeMember')}
                                    disabled={removeMember.isPending}
                                    onClick={() => {
                                      confirm({
                                        title: t('removeMember'),
                                        message: t('removeConfirm'),
                                        confirmLabel: t('removeMember'),
                                        cancelLabel: t('cancel'),
                                        variant: 'danger',
                                        onConfirm: () => {
                                          removeMember.mutate(member.id, {
                                            onSuccess: () =>
                                              toast.success(tc('toast.memberRemoved')),
                                            onError: () =>
                                              toast.error(tc('toast.memberRemoveFailed')),
                                          });
                                        },
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
                                  >
                                    <UserMinus className="h-3 w-3" />
                                  </button>
                                )}
                                {isMemberOwner && !isSelf && (
                                  <span className="text-xs text-muted-foreground">--</span>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={UserPlus}
                title={t('noMembers') || 'No team members yet'}
                description={t('noMembersDescription') || 'Invite team members to collaborate on your organization.'}
              />
            )}
          </div>

          {/* Permission Matrix */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-muted-foreground" />
              {t('permissionMatrix')}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-start font-medium"></th>
                    <th className="pb-2 text-center font-medium">{t('owner')}</th>
                    <th className="pb-2 text-center font-medium">{t('admin')}</th>
                    <th className="pb-2 text-center font-medium">{t('member')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      { labelKey: 'permViewDashboard', owner: true, admin: true, member: true },
                      { labelKey: 'permManageAgents', owner: true, admin: true, member: false },
                      {
                        labelKey: 'permManageConversations',
                        owner: true,
                        admin: true,
                        member: true,
                      },
                      { labelKey: 'permManageChannels', owner: true, admin: true, member: false },
                      { labelKey: 'permViewAnalytics', owner: true, admin: true, member: true },
                      { labelKey: 'permManageTeam', owner: true, admin: true, member: false },
                      { labelKey: 'permManageBilling', owner: true, admin: false, member: false },
                      { labelKey: 'permManageSettings', owner: true, admin: true, member: false },
                      {
                        labelKey: 'permDeleteOrganization',
                        owner: true,
                        admin: false,
                        member: false,
                      },
                    ] as const
                  ).map((row) => (
                    <tr key={row.labelKey} className="border-b last:border-b-0">
                      <td className="py-2.5 text-start font-medium">{t(row.labelKey)}</td>
                      <td className="py-2.5 text-center">
                        {row.owner ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {'\u2713'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{'\u2014'}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        {row.admin ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {'\u2713'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{'\u2014'}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        {row.member ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {'\u2713'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{'\u2014'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role Permissions Info Panel */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              {t('permissions')}
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
                  <Crown className="h-3 w-3" />
                  {t('owner')}
                </span>
                <p className="text-xs text-muted-foreground">{t('ownerDesc')}</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 shrink-0">
                  <ShieldCheck className="h-3 w-3" />
                  {t('admin')}
                </span>
                <p className="text-xs text-muted-foreground">{t('adminDesc')}</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground shrink-0">
                  <Shield className="h-3 w-3" />
                  {t('member')}
                </span>
                <p className="text-xs text-muted-foreground">{t('memberDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog {...confirmProps} />
    </>
  );
}
