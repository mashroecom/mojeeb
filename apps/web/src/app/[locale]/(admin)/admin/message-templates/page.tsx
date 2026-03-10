'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';
import {
  useAdminMessageTemplates,
  useCreateMessageTemplate,
  useUpdateMessageTemplate,
  useDeleteMessageTemplate,
  useAdminMessageTemplateAnalytics,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { FileText, Trash2, Search, Plus, Pencil, X, Loader2, BarChart3, Users, Share2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageTemplate {
  id: string;
  title: string;
  content: string;
  category: string | null;
  shortcut: string | null;
  createdAt: string;
  org: { id: string; name: string } | null;
}

interface FormData {
  title: string;
  content: string;
  category: string;
  shortcut: string;
}

const emptyForm: FormData = {
  title: '',
  content: '',
  category: '',
  shortcut: '',
};

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border bg-card p-6">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="h-6 w-16 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

export default function MessageTemplatesPage() {
  const t = useTranslations('admin.messageTemplates');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const { data, isLoading, error } = useAdminMessageTemplates({
    page,
    limit: 10,
    search: search || undefined,
    category: category || undefined,
  });

  const createMutation = useCreateMessageTemplate();
  const updateMutation = useUpdateMessageTemplate();
  const deleteMutation = useDeleteMessageTemplate();

  const { data: analytics, isLoading: loadingAnalytics } = useAdminMessageTemplateAnalytics();

  const templates: MessageTemplate[] = data?.data ?? [];
  const pagination = data?.pagination;

  // Collect unique categories from current page for filter tabs
  const categories = Array.from(
    new Set(templates.map((tpl) => tpl.category).filter(Boolean)),
  ) as string[];

  // --- Form handlers ---

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(tpl: MessageTemplate) {
    setEditingId(tpl.id);
    setForm({
      title: tpl.title,
      content: tpl.content,
      category: tpl.category || '',
      shortcut: tpl.shortcut || '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      title: form.title,
      content: form.content,
    };
    if (form.category) payload.category = form.category;
    if (form.shortcut) payload.shortcut = form.shortcut;

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...payload } as Parameters<typeof updateMutation.mutateAsync>[0]);
        addToast('success', t('toasts.updated'));
      } else {
        await createMutation.mutateAsync(payload as Parameters<typeof createMutation.mutateAsync>[0]);
        addToast('success', t('toasts.created'));
      }
      closeForm();
    } catch {
      addToast('error', t('toasts.error'));
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        addToast('success', t('toasts.deleted'));
        setDeleteTarget(null);
      },
      onError: () => {
        addToast('error', t('toasts.error'));
      },
    });
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium mb-2">{tc('error')}</p>
      </div>
    );
  }

  return (
    <>
      <div>
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('create')}
          </button>
        </div>

        {/* Analytics Section */}
        {loadingAnalytics ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <StatSkeleton key={i} />
            ))}
          </div>
        ) : analytics ? (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 mb-6">
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center gap-4">
                  <div className={cn('rounded-lg p-2.5 bg-blue-100 dark:bg-blue-900/30')}>
                    <FileText className={cn('h-5 w-5 text-blue-600 dark:text-blue-400')} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('analytics.totalTemplates')}</p>
                    <p className="text-2xl font-bold mt-0.5">
                      {Number(analytics.totalTemplates ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center gap-4">
                  <div className={cn('rounded-lg p-2.5 bg-green-100 dark:bg-green-900/30')}>
                    <BarChart3 className={cn('h-5 w-5 text-green-600 dark:text-green-400')} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('analytics.activeTemplates')}</p>
                    <p className="text-2xl font-bold mt-0.5">
                      {Number(analytics.activeTemplates ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center gap-4">
                  <div className={cn('rounded-lg p-2.5 bg-purple-100 dark:bg-purple-900/30')}>
                    <Share2 className={cn('h-5 w-5 text-purple-600 dark:text-purple-400')} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('analytics.sharedTemplates')}</p>
                    <p className="text-2xl font-bold mt-0.5">
                      {Number(analytics.sharedTemplates ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Templates & Category Distribution */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
              {/* Most Used Templates */}
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">{t('analytics.mostUsed')}</h2>
                </div>
                {analytics.mostUsedTemplates && analytics.mostUsedTemplates.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.mostUsedTemplates.slice(0, 5).map((tpl: any) => (
                      <div key={tpl.id} className="flex items-center justify-between pb-3 border-b last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{tpl.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{tpl.org?.name || '—'}</p>
                        </div>
                        <div className="text-right ms-3">
                          <p className="font-semibold">{tpl.usageCount}</p>
                          <p className="text-xs text-muted-foreground">{tc('uses')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">{tc('noData')}</p>
                )}
              </div>

              {/* Category Distribution */}
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">{t('analytics.byCategory')}</h2>
                </div>
                {analytics.categoryStats && analytics.categoryStats.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.categoryStats.map((cat: any) => (
                      <div key={cat.category || 'uncategorized'} className="flex items-center justify-between pb-3 border-b last:border-0">
                        <p className="font-medium">{cat.category || t('uncategorized')}</p>
                        <p className="font-semibold">{cat._count}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">{tc('noData')}</p>
                )}
              </div>
            </div>
          </>
        ) : null}

        {/* Inline Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-lg border bg-card p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? t('edit') : t('create')}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                aria-label={tc('close')}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Title */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">{t('templateTitle')}</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>

              {/* Content */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">{t('content')}</label>
                <textarea
                  required
                  rows={4}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('category')}
                  <span className="text-muted-foreground font-normal ms-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>

              {/* Shortcut */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('shortcut')}
                  <span className="text-muted-foreground font-normal ms-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.shortcut}
                  onChange={(e) => setForm((f) => ({ ...f, shortcut: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  placeholder="e.g., /greeting"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                {tc('cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </button>
            </div>
          </form>
        )}

        {/* Search + Category Filter */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('search')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border bg-background ps-9 pe-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => { setCategory(''); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                !category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {t('allCategories')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  category === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {t(`category_${cat}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="p-6 space-y-4 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 rounded bg-muted" />
              ))}
            </div>
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 shadow-sm">
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
              <FileText className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">{t('noTemplates')}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('templateTitle')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('category')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('shortcut')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('organization')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('content')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                      {t('created')}
                    </th>
                    <th className="px-4 py-3 text-end text-xs font-medium text-muted-foreground uppercase">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {templates.map((tpl: any) => (
                    <tr key={tpl.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium">{tpl.title}</td>
                      <td className="px-4 py-3 text-sm">
                        {tpl.category ? (
                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                            {t(`category_${tpl.category}`)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                        {tpl.shortcut || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {tpl.org?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                        {locale === 'ar' && tpl.contentAr ? tpl.contentAr : tpl.contentEn}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {fmtDate(tpl.createdAt, locale)}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(tpl)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title={tc('edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(tpl.id)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title={tc('delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {templates.map((tpl) => (
                <div key={tpl.id} className="rounded-xl border bg-card shadow-sm p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{tpl.title}</p>
                      {tpl.category && (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium mt-1 inline-block">
                          {t(`category_${tpl.category}`)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(tpl)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(tpl.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                    {tpl.content}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>{tpl.org?.name || '—'}</span>
                    <span>{fmtDate(tpl.createdAt, locale)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && (
              <AdminPagination
                page={page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
                previousLabel={tc('previous')}
                nextLabel={tc('next')}
                pageLabel={tc('page')}
                ofLabel={tc('of')}
              />
            )}
          </>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <AdminConfirmDialog
        open={!!deleteTarget}
        title={t('deleteTitle')}
        message={t('confirmDelete')}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
