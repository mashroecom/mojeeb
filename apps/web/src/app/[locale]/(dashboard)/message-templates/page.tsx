'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useMessageTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  type MessageTemplate,
} from '@/hooks/useMessageTemplates';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  X,
  Save,
  Zap,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';

const CATEGORIES = ['greeting', 'followUp', 'closing', 'faq', 'other'] as const;

function TemplateForm({
  initial,
  onSave,
  onCancel,
  isSaving,
  t,
}: {
  initial?: MessageTemplate;
  onSave: (data: { title: string; content: string; category: string; shortcut: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [content, setContent] = useState(initial?.content || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [shortcut, setShortcut] = useState(initial?.shortcut || '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSave({ title: title.trim(), content: content.trim(), category, shortcut: shortcut.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t('titleLabel')}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t('category')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">{t('noCategory')}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`cat_${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t('shortcut')}</label>
            <input
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder={t('shortcutPlaceholder')}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">{t('contentLabel')}</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('contentPlaceholder')}
          rows={3}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          required
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={isSaving || !title.trim() || !content.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t('save')}
        </button>
      </div>
    </form>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  greeting: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  followUp: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  closing: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  faq: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

export default function MessageTemplatesPage() {
  const t = useTranslations('dashboard.messageTemplates');
  const tc = useTranslations('common');
  const addToast = useToastStore((s) => s.addToast);

  const { data: templates, isLoading, isError, refetch: refetchTemplates } = useMessageTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [search, setSearch] = useState('');

  const { confirmProps, confirm } = useConfirmDialog();

  function handleCreate(data: { title: string; content: string; category: string; shortcut: string }) {
    createTemplate.mutate(data, {
      onSuccess: () => {
        addToast('success', t('created'));
        setShowForm(false);
      },
      onError: () => addToast('error', t('createFailed')),
    });
  }

  function handleUpdate(data: { title: string; content: string; category: string; shortcut: string }) {
    if (!editingTemplate) return;
    updateTemplate.mutate(
      { templateId: editingTemplate.id, ...data },
      {
        onSuccess: () => {
          addToast('success', t('updated'));
          setEditingTemplate(null);
        },
        onError: () => addToast('error', t('updateFailed')),
      },
    );
  }

  function handleDelete(template: MessageTemplate) {
    confirm({
      title: t('deleteTitle'),
      message: t('deleteConfirm', { name: template.title }),
      onConfirm: () => {
        deleteTemplate.mutate(template.id, {
          onSuccess: () => addToast('success', t('deleted')),
          onError: () => addToast('error', t('deleteFailed')),
        });
      },
    });
  }

  const filtered = (templates || []).filter((tpl) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      tpl.title.toLowerCase().includes(q) ||
      tpl.content.toLowerCase().includes(q) ||
      (tpl.shortcut && tpl.shortcut.toLowerCase().includes(q))
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <p className="font-medium">{tc('somethingWentWrong')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{tc('errorDescription')}</p>
        <button
          onClick={() => refetchTemplates()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {tc('tryAgain')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <ConfirmDialog {...confirmProps} />

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t('title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingTemplate(null); }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('addTemplate')}
        </button>
      </div>

      {/* Create / Edit form */}
      {(showForm || editingTemplate) && (
        <div className="mb-6">
          <TemplateForm
            initial={editingTemplate || undefined}
            onSave={editingTemplate ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditingTemplate(null); }}
            isSaving={createTemplate.isPending || updateTemplate.isPending}
            t={t}
          />
        </div>
      )}

      {/* Search */}
      {templates && templates.length > 0 && (
        <div className="mb-4 relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-lg border bg-background ps-10 pe-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      )}

      {/* Templates grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="group rounded-lg border bg-card p-5 transition-colors hover:border-primary/20"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold truncate">{tpl.title}</h3>
                <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setEditingTemplate(tpl); setShowForm(false); }}
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(tpl)}
                    className="text-muted-foreground hover:text-red-500 p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-3">
                {tpl.content}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                {tpl.category && (
                  <span
                    className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-full',
                      CATEGORY_COLORS[tpl.category] || CATEGORY_COLORS.other,
                    )}
                  >
                    {t(`cat_${tpl.category}` as any)}
                  </span>
                )}
                {tpl.shortcut && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    <Zap className="h-2.5 w-2.5" />
                    /{tpl.shortcut}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t('noResults')}</p>
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Inbox className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">{t('empty')}</p>
          <p className="text-xs mt-1">{t('emptyDesc')}</p>
        </div>
      )}
    </div>
  );
}
