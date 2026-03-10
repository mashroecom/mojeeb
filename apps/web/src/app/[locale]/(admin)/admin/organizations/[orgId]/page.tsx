'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { fmtDate } from '@/lib/dateFormat';
import { useRouter } from '@/i18n/navigation';
import {
  useAdminOrgDetail,
  useAdminOrgMembers,
  useAdminOrgResources,
  useToggleOrgSuspension,
  useDeleteOrganization,
} from '@/hooks/useAdmin';
import { PLAN_COLORS } from '@/lib/admin-constants';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Calendar,
  Building2,
  Users,
  MessageSquare,
  Bot,
  Radio,
  Mail,
  CreditCard,
  Hash,
  Package,
  BookOpen,
  Key,
} from 'lucide-react';

export default function AdminOrgDetailPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const router = useRouter();
  const t = useTranslations('admin');
  const locale = useLocale();

  const { data: org, isLoading, error } = useAdminOrgDetail(orgId);
  const { data: membersData, isLoading: membersLoading } = useAdminOrgMembers(orgId);
  const { data: resources, isLoading: resourcesLoading } = useAdminOrgResources(orgId);
  const toggleSuspension = useToggleOrgSuspension();
  const deleteOrg = useDeleteOrganization();
  const [activeTab, setActiveTab] = useState<'members' | 'resources'>('members');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });

  function handleToggleSuspension() {
    if (!org) return;
    setConfirmDialog({
      open: true,
      title: org.suspendedAt ? t('organizations.activate') : t('organizations.suspend'),
      message: org.suspendedAt
        ? t('organizations.confirmActivate')
        : t('organizations.confirmSuspend'),
      variant: org.suspendedAt ? 'default' : 'danger',
      onConfirm: () => {
        toggleSuspension.mutate(orgId);
      },
    });
  }

  function handleDelete() {
    setConfirmDialog({
      open: true,
      title: t('organizations.delete'),
      message: t('organizations.confirmDelete'),
      variant: 'danger',
      onConfirm: () => {
        deleteOrg.mutate(orgId, {
          onSuccess: () => router.push('/admin/organizations'),
        });
      },
    });
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium mb-2">{t('common.error')}</p>
        <button
          onClick={() => router.push('/admin/organizations')}
          className="text-sm text-primary hover:underline"
        >
          {t('orgDetail.backToOrgs')}
        </button>
      </div>
    );
  }

  if (isLoading || !org) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isSuspended = !!org.suspendedAt;
  const plan = org.subscription?.plan ?? 'FREE';
  const members = membersData?.members ?? membersData ?? [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/admin/organizations')}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('orgDetail.backToOrgs')}
        </button>
        <h1 className="text-2xl font-bold">{t('orgDetail.title')}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Organization Card */}
        <div className="lg:col-span-1 space-y-6">
          {/* Org Info */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex flex-col items-center text-center">
              {/* Icon */}
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="h-10 w-10 text-primary" />
              </div>

              <h2 className="text-lg font-semibold">{org.name}</h2>

              {org.slug && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                  <Hash className="h-3.5 w-3.5" />
                  {org.slug}
                </div>
              )}

              {/* Status badge */}
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-3',
                  isSuspended
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                )}
              >
                {isSuspended ? t('organizations.suspended') : t('organizations.active')}
              </span>

              {/* Created date */}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-3">
                <Calendar className="h-3.5 w-3.5" />
                {t('orgDetail.created')} {fmtDate(org.createdAt, locale)}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 mt-6 pt-6 border-t">
              <button
                onClick={handleToggleSuspension}
                disabled={toggleSuspension.isPending}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full',
                  isSuspended
                    ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50',
                )}
              >
                {isSuspended ? (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    {t('organizations.activate')}
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-4 w-4" />
                    {t('organizations.suspend')}
                  </>
                )}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteOrg.isPending}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-3 py-2 text-sm font-medium transition-colors w-full"
              >
                <Trash2 className="h-4 w-4" />
                {t('organizations.delete')}
              </button>
            </div>
          </div>

          {/* Subscription Info */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              {t('orgDetail.subscription')}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  {t('orgDetail.plan')}
                </div>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                    PLAN_COLORS[plan] ?? PLAN_COLORS.FREE,
                  )}
                >
                  {t(`plan_${plan}`)}
                </span>
              </div>
              {org.subscription?.status && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('orgDetail.subscriptionStatus')}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      org.subscription.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {t(`status_${org.subscription.status}`)}
                  </span>
                </div>
              )}
              {org.subscription?.messagesLimit != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('orgDetail.messagesUsage')}
                  </span>
                  <span className="text-sm font-medium">
                    {org.subscription.messagesUsed ?? 0} / {org.subscription.messagesLimit}
                  </span>
                </div>
              )}
              {org.subscription?.agentsLimit != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('orgDetail.agentsLimit')}
                  </span>
                  <span className="text-sm font-medium">
                    {org._count?.agents ?? 0} / {org.subscription.agentsLimit}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Stats & Members */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              {t('orgDetail.stats')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">{t('organizations.members')}</span>
                </div>
                <p className="text-2xl font-bold">{org._count?.members ?? 0}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-sm">{t('organizations.conversations')}</span>
                </div>
                <p className="text-2xl font-bold">{org._count?.conversations ?? 0}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Bot className="h-4 w-4" />
                  <span className="text-sm">{t('organizations.agents')}</span>
                </div>
                <p className="text-2xl font-bold">{org._count?.agents ?? 0}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Radio className="h-4 w-4" />
                  <span className="text-sm">{t('orgDetail.channels')}</span>
                </div>
                <p className="text-2xl font-bold">{org._count?.channels ?? 0}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b mb-0">
            <button
              onClick={() => setActiveTab('members')}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === 'members'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t('orgDetail.membersList')}
            </button>
            <button
              onClick={() => setActiveTab('resources')}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === 'resources'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t('orgResources.resources')}
            </button>
          </div>

          {/* Resources Tab */}
          {activeTab === 'resources' && (
            <div className="rounded-xl border bg-card p-6">
              {resourcesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[
                    { key: 'messages', icon: MessageSquare, value: resources?.messages ?? 0 },
                    {
                      key: 'conversations',
                      icon: MessageSquare,
                      value: resources?.conversations ?? 0,
                    },
                    { key: 'agents', icon: Bot, value: resources?.agents ?? 0 },
                    { key: 'channels', icon: Radio, value: resources?.channels ?? 0 },
                    {
                      key: 'knowledgeBases',
                      icon: BookOpen,
                      value: resources?.knowledgeBases ?? 0,
                    },
                    { key: 'members', icon: Users, value: resources?.members ?? 0 },
                    { key: 'apiKeys', icon: Key, value: resources?.apiKeys ?? 0 },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.key} className="rounded-lg bg-muted/50 p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm">{t(`orgResources.${item.key}`)}</span>
                        </div>
                        <p className="text-2xl font-bold">{item.value}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Members Table */}
          {activeTab === 'members' && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('orgDetail.membersList')}
                </h3>
              </div>
              {membersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">{t('orgDetail.noMembers')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                          {t('users.name')}
                        </th>
                        <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                          {t('users.email')}
                        </th>
                        <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                          {t('orgDetail.role')}
                        </th>
                        <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                          {t('orgDetail.joinedOrg')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {members.map((member: any) => {
                        const user = member.user ?? member;
                        return (
                          <tr
                            key={member.id || user.id}
                            className="hover:bg-muted/50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <button
                                onClick={() => router.push(`/admin/users/${user.id}`)}
                                className="font-medium hover:text-primary transition-colors"
                              >
                                {user.firstName} {user.lastName}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5" />
                                {user.email}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                                  member.role === 'OWNER'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    : member.role === 'ADMIN'
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                      : 'bg-muted text-muted-foreground',
                                )}
                              >
                                {t(`role_${member.role}`)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {member.createdAt ? fmtDate(member.createdAt, locale) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AdminConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
