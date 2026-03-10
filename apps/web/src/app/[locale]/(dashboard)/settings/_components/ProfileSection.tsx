'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Section } from './SectionWrapper';
import {
  Save,
  Loader2,
  CheckCircle,
  Eye,
  EyeOff,
  Mail,
  User,
  Lock,
  AlertTriangle,
} from 'lucide-react';

const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

interface ProfileSectionProps {
  profileLoading: boolean;
  profile:
    | {
        firstName: string;
        lastName: string;
        email: string;
        emailVerified: boolean;
        createdAt: string;
      }
    | null
    | undefined;
  user: { firstName?: string; lastName?: string } | null | undefined;
  profileFirstName: string;
  setProfileFirstName: (v: string) => void;
  profileLastName: string;
  setProfileLastName: (v: string) => void;
  handleProfileSave: (e: React.FormEvent) => void;
  updateProfileIsPending: boolean;
  showProfileSaved: boolean;
  // Password
  currentPassword: string;
  setCurrentPassword: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmNewPassword: string;
  setConfirmNewPassword: (v: string) => void;
  handleChangePassword: (e: React.FormEvent) => void;
  changePasswordIsPending: boolean;
  passwordStatus: 'idle' | 'success' | 'error' | 'mismatch' | 'tooShort';
  // Verification
  resendVerificationIsPending: boolean;
  resendVerificationStatus: 'idle' | 'success' | 'error';
  onResendVerification: () => void;
  formatDate: (dateStr: string) => string;
}

export function ProfileSection({
  profileLoading,
  profile,
  user,
  profileFirstName,
  setProfileFirstName,
  profileLastName,
  setProfileLastName,
  handleProfileSave,
  updateProfileIsPending,
  showProfileSaved,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmNewPassword,
  setConfirmNewPassword,
  handleChangePassword,
  changePasswordIsPending,
  passwordStatus,
  resendVerificationIsPending,
  resendVerificationStatus,
  onResendVerification,
  formatDate,
}: ProfileSectionProps) {
  const t = useTranslations('dashboard.settings');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <Section icon={User} title={t('profile.title')}>
      <p className="text-sm text-muted-foreground mb-4">{t('profile.subtitle')}</p>
      {profileLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-16 w-16 rounded-full bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted" />
        </div>
      ) : (
        <>
          {/* Avatar & Info */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-semibold">
              {profile?.firstName?.[0] ?? user?.firstName?.[0] ?? ''}
              {profile?.lastName?.[0] ?? user?.lastName?.[0] ?? ''}
            </div>
            <div>
              <p className="font-medium">
                {profile?.firstName} {profile?.lastName}
              </p>
              <p className="text-sm text-muted-foreground" dir="ltr">
                {profile?.email}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {profile?.emailVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle className="h-3 w-3" />
                    {t('profile.emailVerified')}
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                      <AlertTriangle className="h-3 w-3" />
                      {t('profile.emailNotVerified')}
                    </span>
                    <button
                      type="button"
                      disabled={
                        resendVerificationIsPending || resendVerificationStatus === 'success'
                      }
                      onClick={onResendVerification}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10',
                        (resendVerificationIsPending || resendVerificationStatus === 'success') &&
                          'cursor-not-allowed opacity-50',
                      )}
                    >
                      {resendVerificationIsPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Mail className="h-3 w-3" />
                      )}
                      {t('profile.resendVerification')}
                    </button>
                  </>
                )}
              </div>
              {resendVerificationStatus === 'success' && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {t('profile.verificationSent')}
                </p>
              )}
              {resendVerificationStatus === 'error' && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {t('profile.verificationError')}
                </p>
              )}
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profileFirstName" className="block text-sm font-medium mb-1.5">
                  {t('profile.firstName')}
                </label>
                <input
                  id="profileFirstName"
                  type="text"
                  value={profileFirstName}
                  onChange={(e) => setProfileFirstName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="profileLastName" className="block text-sm font-medium mb-1.5">
                  {t('profile.lastName')}
                </label>
                <input
                  id="profileLastName"
                  type="text"
                  value={profileLastName}
                  onChange={(e) => setProfileLastName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">{t('profile.email')}</label>
              <input
                type="email"
                value={profile?.email ?? ''}
                disabled
                className={inputClass}
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">{t('profile.createdAt')}</label>
              <p className="text-sm text-muted-foreground">
                {profile?.createdAt ? formatDate(profile.createdAt) : '--'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={updateProfileIsPending || !profileFirstName.trim()}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                  (updateProfileIsPending || !profileFirstName.trim()) &&
                    'cursor-not-allowed opacity-50',
                )}
              >
                {updateProfileIsPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t('profile.save')}
              </button>
              {showProfileSaved && (
                <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  {t('profile.saved')}
                </span>
              )}
            </div>
          </form>

          {/* Change Password */}
          <div className="mt-6 border-t pt-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              {t('profile.changePassword')}
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium mb-1.5">
                  {t('profile.currentPassword')}
                </label>
                <div className="relative">
                  <input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={inputClass}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium mb-1.5">
                  {t('profile.newPassword')}
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmNewPassword" className="block text-sm font-medium mb-1.5">
                  {t('profile.confirmPassword')}
                </label>
                <div className="relative">
                  <input
                    id="confirmNewPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className={inputClass}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={
                    changePasswordIsPending ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmNewPassword
                  }
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                    (changePasswordIsPending ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmNewPassword) &&
                      'cursor-not-allowed opacity-50',
                  )}
                >
                  {changePasswordIsPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  {t('profile.changePassword')}
                </button>
                {passwordStatus === 'success' && (
                  <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    {t('profile.passwordChanged')}
                  </span>
                )}
                {passwordStatus === 'error' && (
                  <span className="inline-flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    {t('profile.passwordError')}
                  </span>
                )}
                {passwordStatus === 'mismatch' && (
                  <span className="inline-flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    {t('profile.passwordMismatch')}
                  </span>
                )}
                {passwordStatus === 'tooShort' && (
                  <span className="inline-flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    {t('profile.passwordTooShort')}
                  </span>
                )}
              </div>
            </form>
          </div>
        </>
      )}
    </Section>
  );
}
