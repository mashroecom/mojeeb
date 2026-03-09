'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { useRouter } from '@/i18n/navigation';
import {
  useAdminUserDetail,
  useToggleUserSuspension,
  useDeleteUser,
  useToggleSuperAdmin,
  useResetUserPassword,
  useImpersonateUser,
  useAdminLoginActivity,
  useAdminSessions,
  useKillSession,
  useKillUserSessions,
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
import { NotificationsTab } from './_components/NotificationsTab';
import { UserActionsTab } from './_components/UserActionsTab';
import { EmailModal } from './_components/EmailModal';
import { EditProfileModal } from './_components/EditProfileModal';
import {
  ArrowLeft,
  Loader2,
  Building2,
  MessageSquare,
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
  const addToast = useToastStore((s) => s.addToast);

  const { data: user, isLoading, error } = useAdminUserDetail(userId);
  const toggleSuspension = useToggleUserSuspension();
  const deleteUser = useDeleteUser();
  const toggleSuperAdmin = useToggleSuperAdmin();
  const resetPassword = useResetUserPassword();
  const impersonateUser = useImpersonateUser();

  const killSession = useKillSession();
  const killUserSessions = useKillUserSessions();
  const verifyEmail = useVerifyUserEmail();

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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
                <NotificationsTab
                  isLoading={notificationsQuery.isLoading}
                  notificationsData={notificationsQuery.data}
                  currentPage={notificationsPage}
                  onPageChange={setNotificationsPage}
                />
              )}

              {/* User Actions Tab */}
              {activeTab === 'useractions' && (
                <UserActionsTab
                  isLoading={userActionsQuery.isLoading}
                  userActionsData={userActionsQuery.data}
                  currentPage={userActionsPage}
                  onPageChange={setUserActionsPage}
                />
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

      <EditProfileModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        userId={userId}
        user={user}
      />

      <EmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        userId={userId}
        userEmail={user.email || ''}
      />
    </div>
  );
}
