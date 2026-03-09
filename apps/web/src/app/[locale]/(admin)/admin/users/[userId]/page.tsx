'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { fmtDateTime } from '@/lib/dateFormat';
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
import { UserProfileCard } from './_components/UserProfileCard';
import { UserActionsBar } from './_components/UserActionsBar';
import { OrganizationsTab } from './_components/OrganizationsTab';
import { LoginActivityTab } from './_components/LoginActivityTab';
import { SessionsTab } from './_components/SessionsTab';
import { AuditLogTab } from './_components/AuditLogTab';
import { ApiKeysTab } from './_components/ApiKeysTab';
import { ConversationsTab } from './_components/ConversationsTab';
import { LeadsTab } from './_components/LeadsTab';
import {
  ArrowLeft,
  Loader2,
  Building2,
  MessageSquare,
  Send,
  X,
  Key,
  Globe,
  Monitor,
  History,
  Users2,
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

  function handleVerifyEmail() {
    if (!user) return;
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
  }

  function handleToggleSuperAdmin() {
    if (!user) return;
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
  }

  function handleResetPassword() {
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
  }

  function handleImpersonate() {
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
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('userDetail.backToUsers')}
        </button>
        <h1 className="text-2xl font-bold">{t('userDetail.title')}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile Info */}
          <UserProfileCard user={user} isSuspended={isSuspended} />

          {/* Actions */}
          <UserActionsBar
            user={user}
            userId={userId}
            isSuspended={isSuspended}
            verifyEmailIsPending={verifyEmail.isPending}
            toggleSuperAdminIsPending={toggleSuperAdmin.isPending}
            resetPasswordIsPending={resetPassword.isPending}
            impersonateUserIsPending={impersonateUser.isPending}
            toggleSuspensionIsPending={toggleSuspension.isPending}
            deleteUserIsPending={deleteUser.isPending}
            onEditProfile={openEditModal}
            onVerifyEmail={handleVerifyEmail}
            onToggleSuperAdmin={handleToggleSuperAdmin}
            onResetPassword={handleResetPassword}
            onSendEmail={() => setShowEmailModal(true)}
            onImpersonate={handleImpersonate}
            onToggleSuspension={handleToggleSuspension}
            onDelete={handleDelete}
          />
        </div>

        {/* Right column: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs">{t('userDetail.messagesSent')}</span>
              </div>
              <p className="text-2xl font-bold">{user._count?.sentMessages ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Key className="h-4 w-4" />
                <span className="text-xs">{t('userDetail.apiKeys')}</span>
              </div>
              <p className="text-2xl font-bold">{user._count?.apiKeys ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Building2 className="h-4 w-4" />
                <span className="text-xs">{t('userDetail.organizations')}</span>
              </div>
              <p className="text-2xl font-bold">{user.memberships?.length ?? 0}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="rounded-lg border bg-card overflow-hidden">
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
                <OrganizationsTab memberships={user.memberships} />
              )}

              {/* Login Activity Tab */}
              {activeTab === 'logins' && (
                <LoginActivityTab
                  isLoading={loginsLoading}
                  loginData={loginData}
                  currentPage={loginPage}
                  onPageChange={setLoginPage}
                />
              )}

              {/* Active Sessions Tab */}
              {activeTab === 'sessions' && (
                <SessionsTab
                  isLoading={sessionsLoading}
                  sessionData={sessionData}
                  currentPage={sessionPage}
                  onPageChange={setSessionPage}
                  onKillSession={(sessionId) => {
                    setConfirmDialog({
                      open: true,
                      title: t('userDetail.killSession'),
                      message: t('userDetail.confirmKillSession'),
                      variant: 'danger',
                      onConfirm: () => {
                        killSession.mutate(sessionId, {
                          onSuccess: () => addToast('success', t('userDetail.sessionKilled')),
                        });
                      },
                    });
                  }}
                  onKillAllSessions={() => {
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
                  killSessionPending={killSession.isPending}
                  killAllSessionsPending={killUserSessions.isPending}
                />
              )}

              {/* Audit Log Tab */}
              {activeTab === 'audit' && (
                <AuditLogTab
                  isLoading={auditLoading}
                  auditData={auditData}
                  currentPage={auditPage}
                  onPageChange={setAuditPage}
                />
              )}

              {/* API Keys Tab */}
              {activeTab === 'apikeys' && (
                <ApiKeysTab
                  isLoading={apiKeysQuery.isLoading}
                  apiKeysData={apiKeysQuery.data}
                  currentPage={apiKeysPage}
                  onPageChange={setApiKeysPage}
                />
              )}

              {/* Conversations Tab */}
              {activeTab === 'conversations' && (
                <ConversationsTab
                  isLoading={conversationsQuery.isLoading}
                  conversationsData={conversationsQuery.data}
                  currentPage={conversationsPage}
                  onPageChange={setConversationsPage}
                />
              )}

              {/* Leads Tab */}
              {activeTab === 'leads' && (
                <LeadsTab
                  isLoading={leadsQuery.isLoading}
                  leadsData={leadsQuery.data}
                  currentPage={leadsPage}
                  onPageChange={setLeadsPage}
                />
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="space-y-3">
                  {notificationsQuery.isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                  ) : !notificationsQuery.data?.notifications?.length ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('userDetail.noNotifications')}</p>
                  ) : (
                    <>
                      {notificationsQuery.data.notifications.map((notif: any) => (
                        <div key={notif.id} className={cn('flex items-center justify-between p-4 rounded-xl border', notif.isRead ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800')}>
                          <div className="flex items-center gap-3">
                            <Bell className={cn('w-5 h-5', notif.isRead ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400')} />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{notif.title}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{notif.body}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                {notif.type} · {notif.organization?.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <span className={cn('px-2 py-1 rounded-full text-xs font-medium', notif.isRead ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300')}>
                              {notif.isRead ? t('userDetail.read') : t('userDetail.unread')}
                            </span>
                            <p className="text-gray-400 dark:text-gray-500 mt-1">{fmtDateTime(notif.createdAt, locale)}</p>
                          </div>
                        </div>
                      ))}
                      {notificationsQuery.data.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 pt-2">
                          <button onClick={() => setNotificationsPage(p => Math.max(1, p - 1))} disabled={notificationsPage === 1} className="text-sm text-blue-600 disabled:text-gray-400">Previous</button>
                          <span className="text-sm text-gray-500">{notificationsPage} / {notificationsQuery.data.totalPages}</span>
                          <button onClick={() => setNotificationsPage(p => p + 1)} disabled={notificationsPage >= notificationsQuery.data.totalPages} className="text-sm text-blue-600 disabled:text-gray-400">Next</button>
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
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                  ) : !userActionsQuery.data?.logs?.length ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('userDetail.noUserActions')}</p>
                  ) : (
                    <>
                      {userActionsQuery.data.logs.map((log: any) => (
                        <div key={log.id} className="flex items-center justify-between p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800">
                          <div className="flex items-center gap-3">
                            <Activity className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{log.action}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {t('userDetail.target')}: {log.targetType} ({log.targetId?.substring(0, 12)}...)
                              </p>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <p className="text-gray-400 dark:text-gray-500">{fmtDateTime(log.createdAt, locale)}</p>
                          </div>
                        </div>
                      ))}
                      {userActionsQuery.data.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 pt-2">
                          <button onClick={() => setUserActionsPage(p => Math.max(1, p - 1))} disabled={userActionsPage === 1} className="text-sm text-blue-600 disabled:text-gray-400">Previous</button>
                          <span className="text-sm text-gray-500">{userActionsPage} / {userActionsQuery.data.totalPages}</span>
                          <button onClick={() => setUserActionsPage(p => p + 1)} disabled={userActionsPage >= userActionsQuery.data.totalPages} className="text-sm text-blue-600 disabled:text-gray-400">Next</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* User ID */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">User ID</span>
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
                className="rounded-md p-1 hover:bg-muted transition-colors"
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
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('userActions.lastName')}</label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('users.email')}</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('userActions.newPassword')}</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder={t('userActions.newPasswordPlaceholder')}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
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
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
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
                className="rounded-md p-1 hover:bg-muted transition-colors"
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
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowEmailModal(false);
                    setEmailSubject('');
                    setEmailBody('');
                  }}
                  className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
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
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
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
