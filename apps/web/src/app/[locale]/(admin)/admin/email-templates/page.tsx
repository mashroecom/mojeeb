'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDateTime } from '@/lib/dateFormat';
import {
  useAdminEmailTemplates,
  useUpsertEmailTemplate,
  useDeleteEmailTemplate,
  useSeedEmailTemplates,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { Mail, Trash2, X, Loader2, Pencil, Sprout, FileCode2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailTemplate {
  key: string;
  subject: string;
  subjectAr?: string;
  bodyHtml: string;
  bodyHtmlAr?: string;
  bodyText?: string;
  variables?: string[];
  isActive: boolean;
  updatedAt: string;
}

interface FormData {
  subject: string;
  subjectAr: string;
  bodyHtml: string;
  bodyHtmlAr: string;
  bodyText: string;
  variables: string;
}

const emptyForm: FormData = {
  subject: '',
  subjectAr: '',
  bodyHtml: '',
  bodyHtmlAr: '',
  bodyText: '',
  variables: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="h-5 w-48 rounded bg-muted" />
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-3/4 rounded bg-muted" />
      </div>
      <div className="flex items-center gap-4">
        <div className="h-3 w-24 rounded bg-muted" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EmailTemplatesPage() {
  const t = useTranslations('admin.emailTemplates');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useAdminEmailTemplates();
  const upsertMutation = useUpsertEmailTemplate();
  const deleteMutation = useDeleteEmailTemplate();
  const seedMutation = useSeedEmailTemplates();

  const templates: EmailTemplate[] = data ?? [];

  // --- Handlers ---

  function openEdit(tpl: EmailTemplate) {
    setEditingKey(tpl.key);
    setForm({
      subject: tpl.subject || '',
      subjectAr: tpl.subjectAr || '',
      bodyHtml: tpl.bodyHtml || '',
      bodyHtmlAr: tpl.bodyHtmlAr || '',
      bodyText: tpl.bodyText || '',
      variables: (tpl.variables || []).join(', '),
    });
  }

  function closeForm() {
    setEditingKey(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingKey) return;
    try {
      const vars = form.variables
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      await upsertMutation.mutateAsync({
        key: editingKey,
        subject: form.subject,
        subjectAr: form.subjectAr || undefined,
        bodyHtml: form.bodyHtml,
        bodyHtmlAr: form.bodyHtmlAr || undefined,
        bodyText: form.bodyText || undefined,
        variables: vars.length > 0 ? vars : undefined,
      });
      addToast('success', t('toasts.saved'));
      closeForm();
    } catch {
      addToast('error', t('toasts.saveFailed'));
    }
  }

  async function handleDelete(key: string) {
    try {
      await deleteMutation.mutateAsync(key);
      addToast('success', t('toasts.deleted'));
      setDeleteConfirmKey(null);
    } catch {
      addToast('error', t('toasts.deleteFailed'));
    }
  }

  async function handleSeed() {
    try {
      await seedMutation.mutateAsync();
      addToast('success', t('toasts.seeded'));
    } catch {
      addToast('error', t('toasts.seedFailed'));
    }
  }

  const isSubmitting = upsertMutation.isPending;

  // --- Render ---

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={handleSeed}
          disabled={seedMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 shrink-0"
        >
          {seedMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sprout className="h-4 w-4" />
          )}
          {t('seedDefaults')}
        </button>
      </div>

      {/* Edit Form */}
      {editingKey && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-xl border bg-card p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {t('editTemplate')} <span className="font-mono text-primary">{editingKey}</span>
            </h2>
            <button
              type="button"
              onClick={closeForm}
              aria-label={tc('close')}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Subject EN */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('subjectEn')}</label>
              <input
                type="text"
                required
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
              />
            </div>

            {/* Subject AR */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('subjectAr')}</label>
              <input
                type="text"
                value={form.subjectAr}
                onChange={(e) => setForm((f) => ({ ...f, subjectAr: e.target.value }))}
                dir="rtl"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
              />
            </div>

            {/* Body HTML EN */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('bodyHtmlEn')}</label>
              <textarea
                required
                rows={8}
                value={form.bodyHtml}
                onChange={(e) => setForm((f) => ({ ...f, bodyHtml: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors resize-none"
              />
            </div>

            {/* Body HTML AR */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('bodyHtmlAr')}</label>
              <textarea
                rows={8}
                value={form.bodyHtmlAr}
                onChange={(e) => setForm((f) => ({ ...f, bodyHtmlAr: e.target.value }))}
                dir="rtl"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors resize-none"
              />
            </div>

            {/* Variables */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                {t('variables')}
                <span className="text-muted-foreground font-normal ms-1">
                  ({t('commaSeparated')})
                </span>
              </label>
              <input
                type="text"
                value={form.variables}
                onChange={(e) => setForm((f) => ({ ...f, variables: e.target.value }))}
                placeholder={t('variablesPlaceholder')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              {tc('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('save')}
            </button>
          </div>
        </form>
      )}

      {/* Error State */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{t('loadError')}</p>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400"
          >
            {tc('retry')}
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
          <FileCode2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground">{t('noTemplates')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('noTemplatesHint')}</p>
        </div>
      )}

      {/* Template Cards */}
      {!isLoading && !isError && templates.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {templates.map((tpl) => (
            <div
              key={tpl.key}
              className={cn(
                'rounded-xl border bg-card p-5 shadow-sm transition-colors',
                !tpl.isActive && 'opacity-60',
              )}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2 min-w-0">
                  <Mail className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold font-mono truncate">{tpl.key}</h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{tpl.subject}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0',
                    tpl.isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {tpl.isActive ? t('active') : t('inactive')}
                </span>
              </div>

              {/* Variables */}
              {tpl.variables && tpl.variables.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {tpl.variables.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">
                  {t('updated')} {fmtDateTime(tpl.updatedAt, locale)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(tpl)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title={tc('edit')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>

                  {deleteConfirmKey === tpl.key ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(tpl.key)}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2 py-1 text-[10px] font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                      >
                        {deleteMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                        {tc('confirm')}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmKey(null)}
                        className="rounded-lg px-2 py-1 text-[10px] font-medium border hover:bg-muted transition-colors"
                      >
                        {tc('cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmKey(tpl.key)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 transition-colors"
                      title={tc('delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
