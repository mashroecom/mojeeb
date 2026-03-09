'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { fmtDate, fmtDateTime } from '@/lib/dateFormat';
import { useRouter } from '@/i18n/navigation';
import {
  useAdminUserDetail,
  useToggleUserSuspension,
  useDeleteUser,
  useToggleSuperAdmin,
  useResetUserPassword,
  useSendUserEmail,
  useImpersonateUser,
  useAdminLoginActivity,
  useAdminSessions,
  useKillSession,
  useKillUserSessions,
  useUpdateUserProfile,
  useVerifyUserEmail,
  useAdminAuditLog,
  useAdminUserApiKeys,
  useAdminUserConversations,
  useAdminUserLeads,
  useAdminUserNotifications,
  useAdminUserActions,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Loader2,
  UserCheck,
  UserX,
  Trash2,
  Mail,
  Calendar,
  Building2,
  MessageSquare,
  Shield,
  ShieldOff,
  User,
  KeyRound,
  Send,
  UserCog,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Key,
  Bot,
  Globe,
  Monitor,
  LogOut,
  AlertTriangle,
  Pencil,
  History,
  BadgeCheck,
  Users2,
  Briefcase,
  Bell,
  Activity,
} from 'lucide-react';


export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  const router = useRouter();
  const t = useTranslations('admin');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const { data: user, isLoading, error } = useAdminUserDetail(userId);
  const toggleSuspension = useToggleUserSuspension();
  const deleteUser = useDeleteUser();
  const toggleSuperAdmin = useToggleSuperAdmin();
  const resetPassword = useResetUserPassword();
  const sendEmail = useSendUserEmail();
  const impersonateUser = useImpersonateUser();

  const killSession = useKillSession();
  const killUserSessions = useKillUserSessions();
  const updateProfile = useUpdateUserProfile();
  const verifyEmail = useVerifyUserEmail();

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant?: 'danger' | 'default'; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });
  const [activeTab, setActiveTab] = useState<'orgs' | 'logins' | 'sessions' | 'audit' | 'apikeys' | 'conversations' | 'leads' | 'notifications' | 'useractions'>('orgs');
  const [loginPage, setLoginPage] = useState(1);
  const [notificationsPage, setNotificationsPage] = useState(1);
  const [userActionsPage, setUserActionsPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [apiKeysPage, setApiKeysPage] = useState(1);
  const [conversationsPage, setConversationsPage] = useState(1);
  const [leadsPage, setLeadsPage] = useState(1);

  const userEmail = user?.email || '';
  const { data: loginData, isLoading: loginsLoading } = useAdminLoginActivity({
    page: loginPage,
    limit: 5,
    email: userEmail || undefined,
  });
  const { data: sessionData, isLoading: sessionsLoading } = useAdminSessions({
    page: sessionPage,
    limit: 5,
    email: userEmail || undefined,
  });
  const { data: auditData, isLoading: auditLoading } = useAdminAuditLog({
    page: auditPage,
    limit: 5,
    targetId: userId,
    targetType: 'User',
  });
  const apiKeysQuery = useAdminUserApiKeys(userId as string, apiKeysPage);
  const conversationsQuery = useAdminUserConversations(userId as string, conversationsPage);
  const leadsQuery = useAdminUserLeads(userId as string, leadsPage);
  const notificationsQuery = useAdminUserNotifications(userId as string, notificationsPage);
  const userActionsQuery = useAdminUserActions(userId as string, userActionsPage);

  function openEditModal() {
    if (!user) return;
    setEditFirstName(user.firstName || '');
    setEditLastName(user.lastName || '');
    setEditEmail(user.email || '');
    setEditPassword('');
    setShowEditModal(true);
  }

  function handleToggleSuspension() {
    if (!user) return;
    const isSuspended = !!user.suspendedAt;
    const message = isSuspended
      ? t('users.confirmActivate')
      : t('users.confirmSuspend');
    setConfirmDialog({
      open: true,
      title: isSuspended ? t('users.activate') : t('users.suspend'),
      message,
      variant: 'danger',
      onConfirm: () => {
        toggleSuspension.mutate(userId, {
          onSuccess: () =>
            addToast('success', isSuspended ? t('users.activate') : t('users.suspend')),
        });
      },
    });
  }

  function handleDelete() {
    setConfirmDialog({
      open: true,
      title: t('users.delete'),
      message: t('users.confirmDelete'),
      variant: 'danger',
      onConfirm: () => {
        deleteUser.mutate(userId, {
          onSuccess: () => router.push('/admin/users'),
        });
      },
    });
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium mb-2">{t('common.error')}</p>
        <button
          onClick={() => router.push('/admin/users')}
          className="text-sm text-primary hover:underline"
        >
          {t('userDetail.backToUsers')}
        </button>
      </div>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isSuspended = !!user.suspendedAt;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/admin/users')}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('userDetail.backToUsers')}
        </button>
        <h1 className="text-2xl font-bold">{t('userDetail.title')}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile Info */}
          <div className="rounded-xl border bg-card p-6">
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
                      : 'bg-muted text-muted-foreground',
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

            {/* Actions */}
            <div className="flex flex-col gap-2 mt-5 pt-5 border-t">
              {/* Edit Profile */}
              <button
                onClick={openEditModal}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-accent px-3 py-2 text-sm font-medium transition-colors w-full"
              >
                <Pencil className="h-4 w-4" />
                {t('userActions.editProfile')}
              </button>

              {/* Verify Email */}
              <button
                onClick={() => {
                  setConfirmDialog({
                    open: true,
                    title: user.emailVerified ? t('userActions.unverifyEmail') : t('userActions.verifyEmail'),
                    message: user.emailVerified ? t('userActions.confirmUnverifyEmail') : t('userActions.confirmVerifyEmail'),
                    variant: user.emailVerified ? 'danger' : 'default',
                    onConfirm: () => {
                      verifyEmail.mutate(userId, {
                        onSuccess: () =>
                          addToast('success', user.emailVerified ? t('userActions.emailUnverified') : t('userActions.emailVerifiedSuccess')),
                      });
                    },
                  });
                }}
                disabled={verifyEmail.isPending}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full',
                  user.emailVerified
                    ? 'bg-muted text-muted-foreground hover:bg-accent'
                    : 'bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50'
                )}
              >
                <BadgeCheck className="h-4 w-4" />
                {user.emailVerified ? t('userActions.unverifyEmail') : t('userActions.verifyEmail')}
              </button>

              <hr className="my-1" />

              {/* Toggle Super Admin */}
              <button
                onClick={() => {
                  const msg = user.isSuperAdmin
                    ? t('userActions.confirmRemoveSuperAdmin')
                    : t('userActions.confirmMakeSuperAdmin');
                  setConfirmDialog({
                    open: true,
                    title: user.isSuperAdmin
                      ? t('userActions.removeSuperAdmin')
                      : t('userActions.makeSuperAdmin'),
                    message: msg,
                    variant: 'danger',
                    onConfirm: () => {
                      toggleSuperAdmin.mutate(userId, {
                        onSuccess: () =>
                          addToast(
                            'success',
                            user.isSuperAdmin
                              ? t('userActions.demoted')
                              : t('userActions.promoted'),
                          ),
                      });
                    },
                  });
                }}
                disabled={toggleSuperAdmin.isPending}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 px-3 py-2 text-sm font-medium transition-colors w-full"
              >
                {user.isSuperAdmin ? (
                  <ShieldOff className="h-4 w-4" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                {user.isSuperAdmin
                  ? t('userActions.removeSuperAdmin')
                  : t('userActions.makeSuperAdmin')}
              </button>

              {/* Reset Password */}
              <button
                onClick={() => {
                  setConfirmDialog({
                    open: true,
                    title: t('userActions.resetPassword'),
                    message: t('userActions.confirmResetPassword'),
                    variant: 'danger',
                    onConfirm: () => {
                      resetPassword.mutate(userId, {
                        onSuccess: () =>
                          addToast('success', t('userActions.resetPasswordSuccess')),
                      });
                    },
                  });
                }}
                disabled={resetPassword.isPending}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-3 py-2 text-sm font-medium transition-colors w-full"
              >
                {resetPassword.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                {t('userActions.resetPassword')}
              </button>

              {/* Send Email */}
              <button
                onClick={() => setShowEmailModal(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 px-3 py-2 text-sm font-medium transition-colors w-full"
              >
                <Send className="h-4 w-4" />
                {t('userActions.sendEmail')}
              </button>

              {/* Impersonate */}
              <button
                onClick={() => {
                  setConfirmDialog({
                    open: true,
                    title: t('userActions.impersonate'),
                    message: t('userActions.confirmImpersonate'),
                    variant: 'default',
                    onConfirm: () => {
                      impersonateUser.mutate(userId, {
                        onSuccess: (data: any) => {
                          addToast('success', t('userActions.impersonateSuccess'));
                          const url = `${window.location.origin}/en/dashboard?token=${data.accessToken}`;
                          window.open(url, '_blank');
                        },
                      });
                    },
                  });
                }}
                disabled={impersonateUser.isPending}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50 px-3 py-2 text-sm font-medium transition-colors w-full"
              >
                {impersonateUser.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserCog className="h-4 w-4" />
                )}
                {t('userActions.impersonate')}
              </button>

              <hr className="my-1" />

              {/* Suspend / Activate */}
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
                onClick={handleDelete}
                disabled={deleteUser.isPending}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-3 py-2 text-sm font-medium transition-colors w-full"
              >
                <Trash2 className="h-4 w-4" />
                {t('users.delete')}
              </button>
            </div>
          </div>
        </div>

        {/* Right column: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs">{t('userDetail.messagesSent')}</span>
              </div>
              <p className="text-2xl font-bold">{user._count?.sentMessages ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Key className="h-4 w-4" />
                <span className="text-xs">{t('userDetail.apiKeys')}</span>
              </div>
              <p className="text-2xl font-bold">{user._count?.apiKeys ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Building2 className="h-4 w-4" />
                <span className="text-xs">{t('userDetail.organizations')}</span>
              </div>
              <p className="text-2xl font-bold">{user.memberships?.length ?? 0}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex border-b">
              {([
                { key: 'orgs' as const, label: t('userDetail.organizations'), icon: Building2 },
                { key: 'logins' as const, label: t('userDetail.loginActivity'), icon: Globe },
                { key: 'sessions' as const, label: t('userDetail.activeSessions'), icon: Monitor },
                { key: 'audit' as const, label: t('userDetail.auditLog'), icon: History },
                { key: 'apikeys' as const, label: t('userDetail.apiKeys'), icon: Key },
                { key: 'conversations' as const, label: t('userDetail.conversations'), icon: MessageSquare },
                { key: 'leads' as const, label: t('userDetail.leads'), icon: Users2 },
                { key: 'notifications' as const, label: t('userDetail.notifications'), icon: Bell },
                { key: 'useractions' as const, label: t('userDetail.userActions'), icon: Activity },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors',
                    activeTab === tab.key
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Organizations Tab */}
              {activeTab === 'orgs' && (
                <>
                  {user.memberships && user.memberships.length > 0 ? (
                    <div className="divide-y">
                      {user.memberships.map((membership: any) => (
                        <div
                          key={membership.id || membership.org?.id}
                          className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <button
                                onClick={() =>
                                  router.push(`/admin/organizations/${membership.org?.id ?? membership.orgId}`)
                                }
                                className="text-sm font-medium hover:text-primary transition-colors"
                              >
                                {membership.org?.name ?? '—'}
                              </button>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                {membership.org?.slug && <span>{membership.org.slug}</span>}
                                {membership.org?._count && (
                                  <>
                                    <span className="flex items-center gap-1">
                                      <MessageSquare className="h-3 w-3" />
                                      {membership.org._count.conversations}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Bot className="h-3 w-3" />
                                      {membership.org._count.agents}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                              membership.role === 'OWNER'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : membership.role === 'ADMIN'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                  : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {t(`role_${membership.role}`)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('userDetail.noOrganizations')}
                    </p>
                  )}
                </>
              )}

              {/* Login Activity Tab */}
              {activeTab === 'logins' && (
                <>
                  {loginsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : !loginData?.items?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t('userDetail.noLoginActivity')}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {loginData.items.map((item: any) => (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-center justify-between rounded-lg border p-3',
                            item.success
                              ? 'border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10'
                              : 'border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'h-8 w-8 rounded-full flex items-center justify-center',
                              item.success
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : 'bg-red-100 dark:bg-red-900/30'
                            )}>
                              {item.success ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {item.success ? t('userDetail.loginSuccess') : t('userDetail.loginFailed')}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span>{item.ipAddress}</span>
                                {item.failReason && (
                                  <span className="text-red-500">({item.failReason})</span>
                                )}
                              </div>
                              {(item.country || item.city) && (
                                <p className="text-sm text-muted-foreground">
                                  <Globe className="w-3 h-3 inline me-1" />
                                  {[item.city, item.country].filter(Boolean).join(', ') || t('userDetail.unknownLocation')}
                                </p>
                              )}
                              {item.userAgent && (
                                <p className="text-xs text-muted-foreground/70 truncate max-w-xs" title={item.userAgent}>
                                  {item.userAgent.substring(0, 60)}...
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {fmtDateTime(item.createdAt, locale)}
                          </span>
                        </div>
                      ))}
                      {loginData.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-2">
                          <button
                            onClick={() => setLoginPage((p) => Math.max(1, p - 1))}
                            disabled={loginPage === 1}
                            className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                          >
                            {t('common.previous')}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {loginPage} / {loginData.totalPages}
                          </span>
                          <button
                            onClick={() => setLoginPage((p) => Math.min(loginData.totalPages, p + 1))}
                            disabled={loginPage === loginData.totalPages}
                            className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                          >
                            {t('common.next')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Active Sessions Tab */}
              {activeTab === 'sessions' && (
                <>
                  {sessionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : !sessionData?.items?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t('userDetail.noSessions')}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {/* Kill All Sessions button */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              open: true,
                              title: t('userDetail.killAllSessions'),
                              message: t('userDetail.confirmKillAllSessions'),
                              variant: 'danger',
                              onConfirm: () => {
                                killUserSessions.mutate(userId, {
                                  onSuccess: () => addToast('success', t('userDetail.allSessionsKilled')),
                                });
                              },
                            });
                          }}
                          disabled={killUserSessions.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          {t('userDetail.killAllSessions')}
                        </button>
                      </div>

                      {sessionData.items.map((session: any) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <Monitor className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {session.ipAddress || t('userDetail.unknownIP')}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
                                {session.userAgent || '—'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t('userDetail.expires')}: {fmtDateTime(session.expiresAt, locale)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setConfirmDialog({
                                open: true,
                                title: t('userDetail.killSession'),
                                message: t('userDetail.confirmKillSession'),
                                variant: 'danger',
                                onConfirm: () => {
                                  killSession.mutate(session.id, {
                                    onSuccess: () => addToast('success', t('userDetail.sessionKilled')),
                                  });
                                },
                              });
                            }}
                            disabled={killSession.isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-2.5 py-1.5 text-xs font-medium transition-colors"
                          >
                            <X className="h-3 w-3" />
                            {t('userDetail.kill')}
                          </button>
                        </div>
                      ))}
                      {sessionData.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-2">
                          <button
                            onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                            disabled={sessionPage === 1}
                            className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                          >
                            {t('common.previous')}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {sessionPage} / {sessionData.totalPages}
                          </span>
                          <button
                            onClick={() => setSessionPage((p) => Math.min(sessionData.totalPages, p + 1))}
                            disabled={sessionPage === sessionData.totalPages}
                            className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                          >
                            {t('common.next')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Audit Log Tab */}
              {activeTab === 'audit' && (
                <>
                  {auditLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : !auditData?.items?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t('userDetail.noAuditEntries')}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {auditData.items.map((entry: any) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                              <History className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {t(`action_${entry.action}`)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t('userDetail.by')} {entry.user?.firstName} {entry.user?.lastName} ({entry.user?.email})
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {fmtDateTime(entry.createdAt, locale)}
                          </span>
                        </div>
                      ))}
                      {auditData.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-2">
                          <button
                            onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                            disabled={auditPage === 1}
                            className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                          >
                            {t('common.previous')}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {auditPage} / {auditData.totalPages}
                          </span>
                          <button
                            onClick={() => setAuditPage((p) => Math.min(auditData.totalPages, p + 1))}
                            disabled={auditPage === auditData.totalPages}
                            className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                          >
                            {t('common.next')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* API Keys Tab */}
              {activeTab === 'apikeys' && (
                <div className="space-y-3">
                  {apiKeysQuery.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                  ) : !apiKeysQuery.data?.keys?.length ? (
                    <p className="text-center text-muted-foreground py-8">{t('userDetail.noApiKeys')}</p>
                  ) : (
                    <>
                      {apiKeysQuery.data.keys.map((key: any) => (
                        <div key={key.id} className="flex items-center justify-between p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800">
                          <div className="flex items-center gap-3">
                            <Key className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                            <div>
                              <p className="font-medium text-foreground">{key.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {key.keyPrefix}... · {key.org?.name}
                              </p>
                              {key.scopes?.length > 0 && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {key.scopes.map((scope: string) => (
                                    <span key={scope} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{scope}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-end text-sm">
                            <span className={cn('px-2 py-1 rounded-full text-xs font-medium', key.revokedAt ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300')}>
                              {key.revokedAt ? t('userDetail.revoked') : t('userDetail.active')}
                            </span>
                            <p className="text-muted-foreground mt-1">
                              {t('userDetail.lastUsed')}: {key.lastUsedAt ? fmtDateTime(key.lastUsedAt, locale) : t('userDetail.never')}
                            </p>
                            <p className="text-muted-foreground/70">{fmtDate(key.createdAt, locale)}</p>
                          </div>
                        </div>
                      ))}
                      {apiKeysQuery.data.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 pt-2">
                          <button onClick={() => setApiKeysPage(p => Math.max(1, p - 1))} disabled={apiKeysPage === 1} className="text-sm text-blue-600 disabled:text-muted-foreground">{t('common.previous')}</button>
                          <span className="text-sm text-muted-foreground">{apiKeysPage} / {apiKeysQuery.data.totalPages}</span>
                          <button onClick={() => setApiKeysPage(p => p + 1)} disabled={apiKeysPage >= apiKeysQuery.data.totalPages} className="text-sm text-blue-600 disabled:text-muted-foreground">{t('common.next')}</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Conversations Tab */}
              {activeTab === 'conversations' && (
                <div className="space-y-3">
                  {conversationsQuery.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                  ) : !conversationsQuery.data?.conversations?.length ? (
                    <p className="text-center text-muted-foreground py-8">{t('userDetail.noConversations')}</p>
                  ) : (
                    <>
                      {conversationsQuery.data.conversations.map((conv: any) => (
                        <div key={conv.id} className="flex items-center justify-between p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
                          <div className="flex items-center gap-3">
                            <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            <div>
                              <p className="font-medium text-foreground">{conv.customerName || conv.customerEmail || t('anonymous')}</p>
                              <p className="text-sm text-muted-foreground">
                                {conv.channel?.name} · {conv.org?.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-end text-sm">
                            <span className={cn('px-2 py-1 rounded-full text-xs font-medium',
                              conv.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                              conv.status === 'RESOLVED' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                              'bg-muted text-muted-foreground'
                            )}>
                              {t(`convStatus_${conv.status}`)}
                            </span>
                            <p className="text-muted-foreground mt-1">{t('userDetail.messages')}: {conv._count?.messages || 0}</p>
                            <p className="text-muted-foreground/70">{fmtDateTime(conv.updatedAt, locale)}</p>
                          </div>
                        </div>
                      ))}
                      {conversationsQuery.data.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 pt-2">
                          <button onClick={() => setConversationsPage(p => Math.max(1, p - 1))} disabled={conversationsPage === 1} className="text-sm text-blue-600 disabled:text-muted-foreground">{t('common.previous')}</button>
                          <span className="text-sm text-muted-foreground">{conversationsPage} / {conversationsQuery.data.totalPages}</span>
                          <button onClick={() => setConversationsPage(p => p + 1)} disabled={conversationsPage >= conversationsQuery.data.totalPages} className="text-sm text-blue-600 disabled:text-muted-foreground">{t('common.next')}</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Leads Tab */}
              {activeTab === 'leads' && (
                <div className="space-y-3">
                  {leadsQuery.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                  ) : !leadsQuery.data?.leads?.length ? (
                    <p className="text-center text-muted-foreground py-8">{t('userDetail.noLeads')}</p>
                  ) : (
                    <>
                      {leadsQuery.data.leads.map((lead: any) => (
                        <div key={lead.id} className="flex items-center justify-between p-4 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800">
                          <div className="flex items-center gap-3">
                            <Users2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                            <div>
                              <p className="font-medium text-foreground">{lead.name || lead.email || t('unknown')}</p>
                              <p className="text-sm text-muted-foreground">
                                {lead.company && <>{lead.company} · </>}{lead.org?.name}
                              </p>
                              {lead.phone && <p className="text-sm text-muted-foreground">{t('userDetail.phone')}: {lead.phone}</p>}
                              {lead.interests?.length > 0 && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {lead.interests.map((interest: string) => (
                                    <span key={interest} className="text-xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">{interest}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-end text-sm">
                            <span className={cn('px-2 py-1 rounded-full text-xs font-medium',
                              lead.status === 'NEW' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                              lead.status === 'CONTACTED' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                              lead.status === 'QUALIFIED' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                              lead.status === 'CONVERTED' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                              'bg-muted text-muted-foreground'
                            )}>
                              {t(`leadStatus_${lead.status}`)}
                            </span>
                            <p className="text-muted-foreground/70 mt-1">{fmtDate(lead.createdAt, locale)}</p>
                          </div>
                        </div>
                      ))}
                      {leadsQuery.data.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 pt-2">
                          <button onClick={() => setLeadsPage(p => Math.max(1, p - 1))} disabled={leadsPage === 1} className="text-sm text-blue-600 disabled:text-muted-foreground">{t('common.previous')}</button>
                          <span className="text-sm text-muted-foreground">{leadsPage} / {leadsQuery.data.totalPages}</span>
                          <button onClick={() => setLeadsPage(p => p + 1)} disabled={leadsPage >= leadsQuery.data.totalPages} className="text-sm text-blue-600 disabled:text-muted-foreground">{t('common.next')}</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="space-y-3">
                  {notificationsQuery.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                  ) : !notificationsQuery.data?.notifications?.length ? (
                    <p className="text-center text-muted-foreground py-8">{t('userDetail.noNotifications')}</p>
                  ) : (
                    <>
                      {notificationsQuery.data.notifications.map((notif: any) => (
                        <div key={notif.id} className={cn('flex items-center justify-between p-4 rounded-xl border', notif.isRead ? 'bg-muted/50 border-border' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800')}>
                          <div className="flex items-center gap-3">
                            <Bell className={cn('w-5 h-5', notif.isRead ? 'text-muted-foreground' : 'text-blue-600 dark:text-blue-400')} />
                            <div>
                              <p className="font-medium text-foreground">{notif.title}</p>
                              <p className="text-sm text-muted-foreground">{notif.body}</p>
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                {notif.type} · {notif.organization?.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-end text-sm">
                            <span className={cn('px-2 py-1 rounded-full text-xs font-medium', notif.isRead ? 'bg-muted text-muted-foreground' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300')}>
                              {notif.isRead ? t('userDetail.read') : t('userDetail.unread')}
                            </span>
                            <p className="text-muted-foreground/70 mt-1">{fmtDateTime(notif.createdAt, locale)}</p>
                          </div>
                        </div>
                      ))}
                      {notificationsQuery.data.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 pt-2">
                          <button onClick={() => setNotificationsPage(p => Math.max(1, p - 1))} disabled={notificationsPage === 1} className="text-sm text-blue-600 disabled:text-muted-foreground">{t('common.previous')}</button>
                          <span className="text-sm text-muted-foreground">{notificationsPage} / {notificationsQuery.data.totalPages}</span>
                          <button onClick={() => setNotificationsPage(p => p + 1)} disabled={notificationsPage >= notificationsQuery.data.totalPages} className="text-sm text-blue-600 disabled:text-muted-foreground">{t('common.next')}</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* User Actions Tab */}
              {activeTab === 'useractions' && (
                <div className="space-y-3">
                  {userActionsQuery.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                  ) : !userActionsQuery.data?.logs?.length ? (
                    <p className="text-center text-muted-foreground py-8">{t('userDetail.noUserActions')}</p>
                  ) : (
                    <>
                      {userActionsQuery.data.logs.map((log: any) => (
                        <div key={log.id} className="flex items-center justify-between p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800">
                          <div className="flex items-center gap-3">
                            <Activity className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            <div>
                              <p className="font-medium text-foreground">{log.action}</p>
                              <p className="text-sm text-muted-foreground">
                                {t('userDetail.target')}: {log.targetType} ({log.targetId?.substring(0, 12)}...)
                              </p>
                            </div>
                          </div>
                          <div className="text-end text-sm">
                            <p className="text-muted-foreground/70">{fmtDateTime(log.createdAt, locale)}</p>
                          </div>
                        </div>
                      ))}
                      {userActionsQuery.data.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 pt-2">
                          <button onClick={() => setUserActionsPage(p => Math.max(1, p - 1))} disabled={userActionsPage === 1} className="text-sm text-blue-600 disabled:text-muted-foreground">{t('common.previous')}</button>
                          <span className="text-sm text-muted-foreground">{userActionsPage} / {userActionsQuery.data.totalPages}</span>
                          <button onClick={() => setUserActionsPage(p => p + 1)} disabled={userActionsPage >= userActionsQuery.data.totalPages} className="text-sm text-blue-600 disabled:text-muted-foreground">{t('common.next')}</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* User ID */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('userId')}</span>
              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono select-all">
                {user.id}
              </code>
            </div>
          </div>
        </div>
      </div>

      <AdminConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, open: false })); }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{t('userActions.editProfile')}</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-1 hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('userActions.firstName')}</label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('userActions.lastName')}</label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('users.email')}</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('userActions.newPassword')}</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder={t('userActions.newPasswordPlaceholder')}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => {
                    const updates: Record<string, string> = {};
                    if (editFirstName !== user.firstName) updates.firstName = editFirstName;
                    if (editLastName !== user.lastName) updates.lastName = editLastName;
                    if (editEmail !== user.email) updates.email = editEmail;
                    if (editPassword) updates.newPassword = editPassword;
                    if (Object.keys(updates).length === 0) {
                      setShowEditModal(false);
                      return;
                    }
                    updateProfile.mutate(
                      { userId, ...updates },
                      {
                        onSuccess: () => {
                          addToast('success', t('userActions.profileUpdated'));
                          setShowEditModal(false);
                        },
                        onError: () => addToast('error', t('userActions.profileUpdateFailed')),
                      },
                    );
                  }}
                  disabled={updateProfile.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('userActions.saveChanges')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {t('userActions.sendEmailTo')} {user.email}
              </h3>
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailSubject('');
                  setEmailBody('');
                }}
                className="rounded-lg p-1 hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('userActions.emailSubject')}
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={t('userActions.emailSubjectPlaceholder')}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('userActions.emailBody')}
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder={t('userActions.emailBodyPlaceholder')}
                  rows={6}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowEmailModal(false);
                    setEmailSubject('');
                    setEmailBody('');
                  }}
                  className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => {
                    if (!emailSubject.trim() || !emailBody.trim()) {
                      addToast('error', t('userActions.emailFieldsRequired'));
                      return;
                    }
                    sendEmail.mutate(
                      { userId, subject: emailSubject, body: emailBody },
                      {
                        onSuccess: () => {
                          addToast('success', t('userActions.emailSent'));
                          setShowEmailModal(false);
                          setEmailSubject('');
                          setEmailBody('');
                        },
                      },
                    );
                  }}
                  disabled={sendEmail.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {sendEmail.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {t('userActions.send')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
