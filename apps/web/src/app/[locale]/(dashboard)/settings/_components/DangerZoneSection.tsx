'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { Section } from './SectionWrapper';
import { api } from '@/lib/api';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';

const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

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
  const deleteKeyword = t('deleteKeyword');

  return (
    <>
      {/* Delete Organization */}
      <Section
        icon={AlertTriangle}
        title={t('dangerZone')}
        className="border-red-200 dark:border-red-900"
      >
        <p className="text-sm text-muted-foreground mb-4">{t('deleteOrgWarning')}</p>
        <button
          type="button"
          disabled={deleteLoading}
          onClick={onDeleteOrg}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10',
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
        <p className="text-sm text-muted-foreground mb-4">{t('deleteAccountDescription')}</p>
        <button
          type="button"
          onClick={() => setShowDeleteAccountModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
        >
          <Trash2 className="h-4 w-4" />
          {t('deleteAccountButton')}
        </button>
      </Section>

      {/* Delete Account Confirmation Modal */}
      <Dialog
        open={showDeleteAccountModal}
        onOpenChange={(open) => {
          setShowDeleteAccountModal(open);
          if (!open) {
            setDeleteAccountConfirmText('');
            setDeleteAccountError('');
          }
        }}
        size="md"
        title={t('deleteAccount')}
        description={t('deleteAccountConfirm')}
      >
        <div>
          <label htmlFor="deleteAccountConfirm" className="block text-sm font-medium mb-1.5">
            {t('typeDeleteToConfirm')}
          </label>
          <input
            id="deleteAccountConfirm"
            type="text"
            value={deleteAccountConfirmText}
            onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
            placeholder={t('deleteKeyword')}
            className={inputClass}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            autoFocus
          />
        </div>

        {deleteAccountError && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {deleteAccountError}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setShowDeleteAccountModal(false);
              setDeleteAccountConfirmText('');
              setDeleteAccountError('');
            }}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {t('deleteAccountCancel')}
          </button>
          <button
            type="button"
            disabled={deleteAccountLoading || deleteAccountConfirmText !== deleteKeyword}
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
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              (deleteAccountLoading || deleteAccountConfirmText !== deleteKeyword) &&
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
        </div>
      </Dialog>
    </>
  );
}
