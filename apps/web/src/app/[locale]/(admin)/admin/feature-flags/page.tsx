'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { fmtDate } from '@/lib/dateFormat';
import {
  useAdminFeatureFlags,
  useCreateFeatureFlag,
  useUpdateFeatureFlag,
  useDeleteFeatureFlag,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  ToggleLeft,
  Plus,
  X,
  Loader2,
  Trash2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b last:border-b-0">
      <td className="px-4 py-3"><div className="h-3 w-36 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-48 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-6 w-10 rounded-full bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-24 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-7 w-16 rounded bg-muted" /></td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

function ToggleSwitch({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed',
        enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          enabled ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FeatureFlagsPage() {
  const t = useTranslations('admin.featureFlags');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [showForm, setShowForm] = useState(false);
  const [formKey, setFormKey] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formEnabled, setFormEnabled] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant?: 'danger' | 'default'; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });

  const { data, isLoading, isError, refetch } = useAdminFeatureFlags();
  const createFlag = useCreateFeatureFlag();
  const updateFlag = useUpdateFeatureFlag();
  const deleteFlag = useDeleteFeatureFlag();

  const flags: FeatureFlag[] = data?.data ?? data ?? [];

  const handleCreate = async () => {
    if (!formKey.trim()) return;
    // Validate key pattern: lowercase, numbers, underscores
    if (!/^[a-z0-9_]+$/.test(formKey.trim())) {
      addToast('error', t('keyPattern'));
      return;
    }
    try {
      await createFlag.mutateAsync({
        key: formKey.trim(),
        description: formDescription.trim(),
        enabled: formEnabled,
      });
      addToast('success', t('created'));
      setShowForm(false);
      setFormKey('');
      setFormDescription('');
      setFormEnabled(false);
    } catch {
      addToast('error', tc('error'));
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      await updateFlag.mutateAsync({ key: flag.key, enabled: !flag.enabled });
      addToast('success', t('updated'));
    } catch {
      addToast('error', tc('error'));
    }
  };

  const handleDelete = (key: string) => {
    setConfirmDialog({
      open: true,
      title: t('delete'),
      message: t('confirmDelete'),
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteFlag.mutateAsync(key);
          addToast('success', t('deleted'));
        } catch {
          addToast('error', tc('error'));
        }
      },
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors shrink-0"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {t('createFlag')}
        </button>
      </div>

      {/* Create Flag Form */}
      {showForm && (
        <div className="mb-6 rounded-lg border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t('key')} *
              </label>
              <input
                type="text"
                value={formKey}
                onChange={(e) => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="enable_dark_mode"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{t('keyPattern')}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t('description')}
              </label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Description of this flag..."
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {t('enabled')}
                </label>
                <ToggleSwitch enabled={formEnabled} onChange={() => setFormEnabled(!formEnabled)} />
              </div>
              <button
                onClick={handleCreate}
                disabled={createFlag.isPending || !formKey.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:pointer-events-none ms-auto"
              >
                {createFlag.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{tc('error')}</p>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400"
          >
            {tc('retry')}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('key')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('description')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('enabled')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('createdAt')}
                </th>
                <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}

              {!isLoading && !isError && flags.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <ToggleLeft className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                    <p className="text-sm text-muted-foreground">{t('noRecords')}</p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                flags.map((flag) => (
                  <tr key={flag.key} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono font-medium">{flag.key}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground truncate block max-w-[300px]">
                        {flag.description || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ToggleSwitch
                        enabled={flag.enabled}
                        onChange={() => handleToggle(flag)}
                        disabled={updateFlag.isPending}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {fmtDate(flag.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(flag.key)}
                        disabled={deleteFlag.isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        {t('delete')}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
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
    </div>
  );
}
