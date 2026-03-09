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
  Settings,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercentage?: number;
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
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed',
        enabled ? 'bg-green-500' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          enabled ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'translate-x-0',
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
  const [configureFlag, setConfigureFlag] = useState<FeatureFlag | null>(null);
  const [rolloutValue, setRolloutValue] = useState(100);

  const { data, isLoading, isError, refetch } = useAdminFeatureFlags();
  const createFlag = useCreateFeatureFlag();
  const updateFlag = useUpdateFeatureFlag();
  const deleteFlag = useDeleteFeatureFlag();

  const flags: FeatureFlag[] = data ?? [];

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

  const handleConfigure = (flag: FeatureFlag) => {
    setConfigureFlag(flag);
    setRolloutValue((flag as any).metadata?.rolloutPercentage ?? 100);
  };

  const handleSaveRollout = async () => {
    if (!configureFlag) return;
    try {
      await updateFlag.mutateAsync({ key: configureFlag.key, metadata: { rolloutPercentage: rolloutValue } } as any);
      addToast('success', t('updated'));
      setConfigureFlag(null);
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
          className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors shrink-0"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {t('createFlag')}
        </button>
      </div>

      {/* Create Flag Form */}
      {showForm && (
        <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t('key')} *
              </label>
              <input
                type="text"
                value={formKey}
                onChange={(e) => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder={t('keyPlaceholder')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
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
                placeholder={t('descriptionPlaceholder')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
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
                className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:pointer-events-none ms-auto"
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
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-muted/50">
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
                  <tr key={flag.key} className="border-b last:border-b-0 hover:bg-muted/50 transition-colors">
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleConfigure(flag)}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                        >
                          <Settings className="h-3 w-3" />
                          {t('configure')}
                        </button>
                        <button
                          onClick={() => handleDelete(flag.key)}
                          disabled={deleteFlag.isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          {t('delete')}
                        </button>
                      </div>
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

      {/* Configure Modal */}
      {configureFlag && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setConfigureFlag(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{t('configure')}: {configureFlag.key}</h3>
                <button
                  onClick={() => setConfigureFlag(null)}
                  className="rounded-lg p-1 hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    {t('rolloutPercentage')}: {rolloutValue}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={rolloutValue}
                    onChange={(e) => setRolloutValue(Number(e.target.value))}
                    className="w-full accent-red-600"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSaveRollout}
                    disabled={updateFlag.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:pointer-events-none flex-1 justify-center"
                  >
                    {updateFlag.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('saveChanges')}
                  </button>
                  <button
                    onClick={() => setConfigureFlag(null)}
                    className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors flex-1 justify-center"
                  >
                    {tc('cancel')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
