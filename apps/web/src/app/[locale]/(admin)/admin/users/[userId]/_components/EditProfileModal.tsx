'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useUpdateUserProfile } from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { X, Loader2 } from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  user: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

export function EditProfileModal({
  isOpen,
  onClose,
  userId,
  user,
}: EditProfileModalProps) {
  const t = useTranslations('admin');
  const addToast = useToastStore((s) => s.addToast);
  const updateProfile = useUpdateUserProfile();

  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');

  useEffect(() => {
    if (isOpen && user) {
      setEditFirstName(user.firstName || '');
      setEditLastName(user.lastName || '');
      setEditEmail(user.email || '');
      setEditPassword('');
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleClose = () => {
    setEditFirstName('');
    setEditLastName('');
    setEditEmail('');
    setEditPassword('');
    onClose();
  };

  const handleSave = () => {
    const updates: Record<string, string> = {};
    if (editFirstName !== user.firstName) updates.firstName = editFirstName;
    if (editLastName !== user.lastName) updates.lastName = editLastName;
    if (editEmail !== user.email) updates.email = editEmail;
    if (editPassword) updates.newPassword = editPassword;

    if (Object.keys(updates).length === 0) {
      handleClose();
      return;
    }

    updateProfile.mutate(
      { userId, ...updates },
      {
        onSuccess: () => {
          addToast('success', t('userActions.profileUpdated'));
          handleClose();
        },
        onError: () => addToast('error', t('userActions.profileUpdateFailed')),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t('userActions.editProfile')}</h3>
          <button
            onClick={handleClose}
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
              onClick={handleClose}
              className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
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
  );
}
