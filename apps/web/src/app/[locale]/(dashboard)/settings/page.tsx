'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import {
  useOrganization,
  useUpdateOrganization,
} from '@/hooks/useOrganization';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useProfile, useUpdateProfile, useChangePassword, useResendVerification } from '@/hooks/useProfile';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/hooks/useNotifications';
import { ProfileSection } from './_components/ProfileSection';
import { OrganizationSection } from './_components/OrganizationSection';
import { NotificationsSection } from './_components/NotificationsSection';
import { DangerZoneSection } from './_components/DangerZoneSection';

export default function SettingsPage() {
  const t = useTranslations('dashboard.settings');
  const locale = useLocale();
  const { data: org, isLoading } = useOrganization();
  const updateOrg = useUpdateOrganization();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const orgId = useAuthStore((s) => s.organization?.id);
  const router = useRouter();
  const { confirmProps, confirm } = useConfirmDialog();

  // Profile
  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const resendVerification = useResendVerification();
  const [resendVerificationStatus, setResendVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [showProfileSaved, setShowProfileSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'success' | 'error' | 'mismatch' | 'tooShort'>('idle');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Notification preferences
  const { data: notifPrefs } = useNotificationPreferences();
  const updateNotifPrefs = useUpdateNotificationPreferences();

  // Organization form state
  const [orgName, setOrgName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [timezone, setTimezone] = useState('Asia/Riyadh');
  const [defaultLanguage, setDefaultLanguage] = useState('ar');
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (org) {
      setOrgName(org.name);
      setWebsiteUrl(org.websiteUrl || '');
      setTimezone(org.timezone || 'Asia/Riyadh');
      setDefaultLanguage(org.defaultLanguage || 'ar');
    }
  }, [org]);

  useEffect(() => {
    if (profile) {
      setProfileFirstName(profile.firstName);
      setProfileLastName(profile.lastName);
    }
  }, [profile]);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(
      { firstName: profileFirstName.trim(), lastName: profileLastName.trim() },
      {
        onSuccess: () => {
          setShowProfileSaved(true);
          setTimeout(() => setShowProfileSaved(false), 3000);
        },
      },
    );
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPasswordStatus('tooShort');
      setTimeout(() => setPasswordStatus('idle'), 3000);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordStatus('mismatch');
      setTimeout(() => setPasswordStatus('idle'), 3000);
      return;
    }
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setPasswordStatus('success');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
          setTimeout(() => setPasswordStatus('idle'), 3000);
        },
        onError: () => {
          setPasswordStatus('error');
          setTimeout(() => setPasswordStatus('idle'), 3000);
        },
      },
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    updateOrg.mutate(
      {
        name: orgName.trim(),
        websiteUrl: websiteUrl.trim() || undefined,
        timezone,
        defaultLanguage,
      },
      {
        onSuccess: () => {
          setShowSaved(true);
          setTimeout(() => setShowSaved(false), 3000);
        },
      },
    );
  };

  const handleResendVerification = () => {
    resendVerification.mutate(undefined, {
      onSuccess: () => {
        setResendVerificationStatus('success');
        setTimeout(() => setResendVerificationStatus('idle'), 5000);
      },
      onError: () => {
        setResendVerificationStatus('error');
        setTimeout(() => setResendVerificationStatus('idle'), 5000);
      },
    });
  };

  const handleDeleteOrg = () => {
    confirm({
      title: t('deleteOrgButton'),
      message: t('deleteOrgConfirm'),
      confirmLabel: t('deleteOrgButton'),
      cancelLabel: t('cancel'),
      variant: 'danger',
      onConfirm: async () => {
        setDeleteLoading(true);
        try {
          await api.delete(`/organizations/${orgId}`);
          clearAuth();
          router.push('/login');
        } catch {
          setDeleteLoading(false);
        }
      },
    });
  };

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

        <div className="mx-auto max-w-2xl space-y-6">
          <ProfileSection
            profileLoading={profileLoading}
            profile={profile}
            user={user}
            profileFirstName={profileFirstName}
            setProfileFirstName={setProfileFirstName}
            profileLastName={profileLastName}
            setProfileLastName={setProfileLastName}
            handleProfileSave={handleProfileSave}
            updateProfileIsPending={updateProfile.isPending}
            showProfileSaved={showProfileSaved}
            currentPassword={currentPassword}
            setCurrentPassword={setCurrentPassword}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmNewPassword={confirmNewPassword}
            setConfirmNewPassword={setConfirmNewPassword}
            handleChangePassword={handleChangePassword}
            changePasswordIsPending={changePassword.isPending}
            passwordStatus={passwordStatus}
            resendVerificationIsPending={resendVerification.isPending}
            resendVerificationStatus={resendVerificationStatus}
            onResendVerification={handleResendVerification}
            formatDate={(d: string) => fmtDate(d, locale)}
          />

          <OrganizationSection
            isLoading={isLoading}
            orgName={orgName}
            setOrgName={setOrgName}
            websiteUrl={websiteUrl}
            setWebsiteUrl={setWebsiteUrl}
            timezone={timezone}
            setTimezone={setTimezone}
            defaultLanguage={defaultLanguage}
            setDefaultLanguage={setDefaultLanguage}
            handleSave={handleSave}
            updateOrgIsPending={updateOrg.isPending}
            showSaved={showSaved}
          />

          <NotificationsSection
            notifPrefs={notifPrefs}
            updateNotifPrefsIsPending={updateNotifPrefs.isPending}
            onToggle={(patch) => updateNotifPrefs.mutate(patch)}
          />

          <DangerZoneSection
            orgId={orgId}
            deleteLoading={deleteLoading}
            setDeleteLoading={setDeleteLoading}
            onDeleteOrg={handleDeleteOrg}
            clearAuth={clearAuth}
            routerPush={(path) => router.push(path)}
          />
        </div>
      </div>
      <ConfirmDialog {...confirmProps} />
    </>
  );
}
