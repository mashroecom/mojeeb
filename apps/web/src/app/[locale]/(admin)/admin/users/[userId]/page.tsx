'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { useRouter } from '@/i18n/navigation';
import {
  useAdminUserDetail,
  useAdminLoginActivity,
  useAdminSessions,
  useAdminAuditLog,
  useAdminUserApiKeys,
  useAdminUserConversations,
  useAdminUserLeads,
  useAdminUserNotifications,
  useAdminUserActions,
} from '@/hooks/useAdmin';
import { Loader2 } from 'lucide-react';
import { UserProfileCard } from './_components/UserProfileCard';
import { UserActionsBar } from './_components/UserActionsBar';
import { UserDetailHeader } from './_components/UserDetailHeader';
import { UserStatsSection } from './_components/UserStatsSection';
import { UserTabsSection } from './_components/UserTabsSection';
import { EmailModal } from './_components/EmailModal';
import { EditProfileModal } from './_components/EditProfileModal';
import { useUserDetailActions } from './_hooks/useUserDetailActions';

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  const router = useRouter();
  const t = useTranslations('admin');

  const { data: user, isLoading, error } = useAdminUserDetail(userId);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });

  const [activeTab, setActiveTab] = useState<
    'orgs' | 'logins' | 'sessions' | 'audit' | 'apikeys' | 'conversations' | 'leads' | 'notifications' | 'useractions'
  >('orgs');
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

  const { mutations, handlers } = useUserDetailActions(userId, user, setConfirmDialog);

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
      <UserDetailHeader />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <UserProfileCard user={user} isSuspended={isSuspended} />

          <UserActionsBar
            user={user}
            userId={userId}
            isSuspended={isSuspended}
            verifyEmailIsPending={mutations.verifyEmail.isPending}
            toggleSuperAdminIsPending={mutations.toggleSuperAdmin.isPending}
            resetPasswordIsPending={mutations.resetPassword.isPending}
            impersonateUserIsPending={mutations.impersonateUser.isPending}
            toggleSuspensionIsPending={mutations.toggleSuspension.isPending}
            deleteUserIsPending={mutations.deleteUser.isPending}
            onEditProfile={() => setShowEditModal(true)}
            onVerifyEmail={handlers.handleVerifyEmail}
            onToggleSuperAdmin={handlers.handleToggleSuperAdmin}
            onResetPassword={handlers.handleResetPassword}
            onSendEmail={() => setShowEmailModal(true)}
            onImpersonate={handlers.handleImpersonate}
            onToggleSuspension={handlers.handleToggleSuspension}
            onDelete={handlers.handleDelete}
          />
        </div>

        {/* Right column: Details */}
        <div className="lg:col-span-2 space-y-6">
          <UserStatsSection user={user} />

          <UserTabsSection
            user={user}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            loginData={loginData}
            loginsLoading={loginsLoading}
            loginPage={loginPage}
            onLoginPageChange={setLoginPage}
            sessionData={sessionData}
            sessionsLoading={sessionsLoading}
            sessionPage={sessionPage}
            onSessionPageChange={setSessionPage}
            onKillSession={handlers.handleKillSession}
            onKillAllSessions={handlers.handleKillAllSessions}
            killSessionPending={mutations.killSession.isPending}
            killAllSessionsPending={mutations.killUserSessions.isPending}
            auditData={auditData}
            auditLoading={auditLoading}
            auditPage={auditPage}
            onAuditPageChange={setAuditPage}
            apiKeysQuery={apiKeysQuery}
            apiKeysPage={apiKeysPage}
            onApiKeysPageChange={setApiKeysPage}
            conversationsQuery={conversationsQuery}
            conversationsPage={conversationsPage}
            onConversationsPageChange={setConversationsPage}
            leadsQuery={leadsQuery}
            leadsPage={leadsPage}
            onLeadsPageChange={setLeadsPage}
            notificationsQuery={notificationsQuery}
            notificationsPage={notificationsPage}
            onNotificationsPageChange={setNotificationsPage}
            userActionsQuery={userActionsQuery}
            userActionsPage={userActionsPage}
            onUserActionsPageChange={setUserActionsPage}
          />

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
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
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
