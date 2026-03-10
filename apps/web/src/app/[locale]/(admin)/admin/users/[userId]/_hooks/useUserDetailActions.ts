import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useToastStore } from '@/hooks/useToast';
import {
  useToggleUserSuspension,
  useDeleteUser,
  useToggleSuperAdmin,
  useResetUserPassword,
  useImpersonateUser,
  useVerifyUserEmail,
  useKillSession,
  useKillUserSessions,
} from '@/hooks/useAdmin';

interface ConfirmDialog {
  open: boolean;
  title: string;
  message: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
}

export function useUserDetailActions(
  userId: string,
  user: any,
  setConfirmDialog: (dialog: ConfirmDialog) => void,
) {
  const router = useRouter();
  const t = useTranslations('admin');
  const addToast = useToastStore((s) => s.addToast);

  const toggleSuspension = useToggleUserSuspension();
  const deleteUser = useDeleteUser();
  const toggleSuperAdmin = useToggleSuperAdmin();
  const resetPassword = useResetUserPassword();
  const impersonateUser = useImpersonateUser();
  const verifyEmail = useVerifyUserEmail();
  const killSession = useKillSession();
  const killUserSessions = useKillUserSessions();

  function handleToggleSuspension() {
    if (!user) return;
    const isSuspended = !!user.suspendedAt;
    const message = isSuspended ? t('users.confirmActivate') : t('users.confirmSuspend');
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
      message: user.emailVerified
        ? t('userActions.confirmUnverifyEmail')
        : t('userActions.confirmVerifyEmail'),
      variant: user.emailVerified ? 'danger' : 'default',
      onConfirm: () => {
        verifyEmail.mutate(userId, {
          onSuccess: () =>
            addToast(
              'success',
              user.emailVerified
                ? t('userActions.emailUnverified')
                : t('userActions.emailVerifiedSuccess'),
            ),
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
              user.isSuperAdmin ? t('userActions.demoted') : t('userActions.promoted'),
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
          onSuccess: () => addToast('success', t('userActions.resetPasswordSuccess')),
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

  function handleKillSession(sessionId: string) {
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
  }

  function handleKillAllSessions() {
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
  }

  return {
    mutations: {
      toggleSuspension,
      deleteUser,
      toggleSuperAdmin,
      resetPassword,
      impersonateUser,
      verifyEmail,
      killSession,
      killUserSessions,
    },
    handlers: {
      handleToggleSuspension,
      handleDelete,
      handleVerifyEmail,
      handleToggleSuperAdmin,
      handleResetPassword,
      handleImpersonate,
      handleKillSession,
      handleKillAllSessions,
    },
  };
}
