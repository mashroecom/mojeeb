'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { Section } from './SectionWrapper';
import { api } from '@/lib/api';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';

const inputClass =
  'w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

interface DangerZoneSectionProps {
  orgId: string | undefined;
  deleteLoading: boolean;
  setDeleteLoading: (v: boolean) => void;
  onDeleteOrg: () => void;
  clearAuth: () => void;
  routerPush: (path: string) => void;
}

export function DangerZoneSection({
  orgId,
  deleteLoading,
  setDeleteLoading,
  onDeleteOrg,
  clearAuth,
  routerPush,
}: DangerZoneSectionProps) {
  const t = useTranslations('dashboard.settings');
  const locale = useLocale();
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('');
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');

  return (
    <>
      {/* Delete Organization */}
      <Section
        icon={AlertTriangle}
        title={t('dangerZone')}
        className="border-red-200 dark:border-red-900"
      >
        <p className="text-sm text-muted-foreground mb-4">
          {t('deleteOrgWarning')}
        </p>
        <button
          type="button"
          disabled={deleteLoading}
          onClick={onDeleteOrg}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950',
            deleteLoading && 'cursor-not-allowed opacity-50',
          )}
        >
          {deleteLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {t('deleteOrgButton')}
        </button>
      </Section>

      {/* Delete Account */}
      <Section
        icon={Trash2}
        title={t('deleteAccount')}
        className="border-red-200 dark:border-red-900"
      >
        <p className="text-sm text-muted-foreground mb-4">
          {t('deleteAccountDescription')}
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteAccountModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
        >
          <Trash2 className="h-4 w-4" />
          {t('deleteAccountButton')}
        </button>
      </Section>

      {/* Delete Account Confirmation Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowDeleteAccountModal(false);
              setDeleteAccountConfirmText('');
            }}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border bg-card p-6 shadow-lg mx-4">
            <button
              type="button"
              onClick={() => {
                setShowDeleteAccountModal(false);
                setDeleteAccountConfirmText('');
              }}
              className="absolute top-4 end-4 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                {t('deleteAccount')}
              </h3>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              {t('deleteAccountConfirm')}
            </p>

            <div className="mb-4">
              <label
                htmlFor="deleteAccountConfirm"
                className="block text-sm font-medium mb-1.5"
              >
                {t('typeDeleteToConfirm')}
              </label>
              <input
                id="deleteAccountConfirm"
                type="text"
                value={deleteAccountConfirmText}
                onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
                placeholder={locale === 'ar' ? '\u062d\u0630\u0641' : 'DELETE'}
                className={inputClass}
                dir={locale === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>

            {deleteAccountError && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {deleteAccountError}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={
                  deleteAccountLoading ||
                  (deleteAccountConfirmText !== 'DELETE' &&
                    deleteAccountConfirmText !== '\u062d\u0630\u0641')
                }
                onClick={async () => {
                  setDeleteAccountLoading(true);
                  setDeleteAccountError('');
                  try {
                    await api.delete('/auth/me');
                    clearAuth();
                    routerPush('/login');
                  } catch {
                    setDeleteAccountLoading(false);
                    setDeleteAccountError(t('deleteAccountFailed'));
                  }
                }}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800',
                  (deleteAccountLoading ||
                    (deleteAccountConfirmText !== 'DELETE' &&
                      deleteAccountConfirmText !== '\u062d\u0630\u0641')) &&
                    'cursor-not-allowed opacity-50',
                )}
              >
                {deleteAccountLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {t('deleteAccountButton')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteAccountConfirmText('');
                }}
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                {t('deleteAccountCancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
