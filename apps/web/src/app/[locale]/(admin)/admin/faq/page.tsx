'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  useAdminFAQs,
  useCreateFAQ,
  useUpdateFAQ,
  useDeleteFAQ,
  useReorderFAQs,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminModal } from '@/components/admin/AdminModal';
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { HelpCircle, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FAQ {
  id: string;
  question: string;
  questionAr: string;
  answer: string;
  answerAr: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  question: string;
  questionAr: string;
  answer: string;
  answerAr: string;
  isActive: boolean;
}

const emptyForm: FormData = {
  question: '',
  questionAr: '',
  answer: '',
  answerAr: '',
  isActive: true,
};

const inputCls =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors';

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-green-500' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5',
          checked ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0.5 rtl:-translate-x-0.5',
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminFAQPage() {
  const t = useTranslations('admin.faq');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const addToast = useToastStore((s) => s.addToast);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useAdminFAQs();
  const createMutation = useCreateFAQ();
  const updateMutation = useUpdateFAQ();
  const deleteMutation = useDeleteFAQ();
  const reorderMutation = useReorderFAQs();

  const faqs: FAQ[] = Array.isArray(data) ? data : [];
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // --- Handlers ---

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(faq: FAQ) {
    setEditingId(faq.id);
    setForm({
      question: faq.question,
      questionAr: faq.questionAr,
      answer: faq.answer,
      answerAr: faq.answerAr,
      isActive: faq.isActive,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      question: form.question.trim(),
      questionAr: form.questionAr.trim(),
      answer: form.answer.trim(),
      answerAr: form.answerAr.trim(),
      isActive: form.isActive,
    };

    if (editingId) {
      updateMutation.mutate(
        { id: editingId, ...payload },
        {
          onSuccess: () => {
            addToast('success', t('updated'));
            closeForm();
          },
          onError: () => addToast('error', tc('failedUpdate')),
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          addToast('success', t('created'));
          closeForm();
        },
        onError: () => addToast('error', tc('failedCreate')),
      });
    }
  }

  function handleToggleActive(faq: FAQ) {
    updateMutation.mutate(
      { id: faq.id, isActive: !faq.isActive },
      { onError: () => addToast('error', tc('failedToggle')) },
    );
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= faqs.length) return;
    const ids = faqs.map((f) => f.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids, { onError: () => addToast('error', tc('failedReorder')) });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        addToast('success', t('deleted'));
        setDeleteTarget(null);
      },
      onError: () => addToast('error', tc('failedDelete')),
    });
  }

  // --- Render ---

  const addButton = (
    <button
      type="button"
      onClick={openCreate}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    >
      <Plus className="h-4 w-4" />
      {t('addNew')}
    </button>
  );

  return (
    <>
      <div>
        <AdminPageHeader title={t('title')} subtitle={t('subtitle')} actions={addButton} />

        {/* Error State */}
        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950">
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{t('failedLoad')}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400"
            >
              {tc('retry')}
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="p-6 space-y-4 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 rounded bg-muted" />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && faqs.length === 0 && (
          <div className="rounded-xl border bg-card shadow-sm">
            <AdminEmptyState icon={HelpCircle} message={t('noFaqs')} action={addButton} />
          </div>
        )}

        {/* FAQ List */}
        {!isLoading && !isError && faqs.length > 0 && (
          <ul className="rounded-xl border bg-card shadow-sm divide-y overflow-hidden">
            {faqs.map((faq, index) => {
              const primaryQuestion = isAr ? faq.questionAr || faq.question : faq.question;
              const primaryAnswer = isAr ? faq.answerAr || faq.answer : faq.answer;
              const secondaryQuestion = isAr ? faq.question : faq.questionAr;
              const missingArabic = !faq.questionAr || !faq.answerAr;

              return (
                <li
                  key={faq.id}
                  data-testid="faq-row"
                  className={cn(
                    'flex items-start gap-3 p-4 transition-colors hover:bg-muted/40',
                    !faq.isActive && 'bg-muted/20',
                  )}
                >
                  {/* Reorder */}
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0 || reorderMutation.isPending}
                      title={t('moveUp')}
                      aria-label={t('moveUp')}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === faqs.length - 1 || reorderMutation.isPending}
                      title={t('moveDown')}
                      aria-label={t('moveDown')}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className={cn('min-w-0 flex-1', !faq.isActive && 'opacity-60')}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold break-words">
                        <bdi>{primaryQuestion}</bdi>
                      </h3>
                      <AdminBadge variant={faq.isActive ? 'success' : 'default'}>
                        {faq.isActive ? t('active') : t('inactive')}
                      </AdminBadge>
                      {missingArabic && <AdminBadge variant="warning">{t('noArabic')}</AdminBadge>}
                    </div>
                    {secondaryQuestion && secondaryQuestion !== primaryQuestion && (
                      <p className="mt-0.5 text-xs text-muted-foreground break-words">
                        <bdi>{secondaryQuestion}</bdi>
                      </p>
                    )}
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2 break-words">
                      <bdi>{primaryAnswer}</bdi>
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Toggle
                      checked={faq.isActive}
                      onChange={() => handleToggleActive(faq)}
                      disabled={updateMutation.isPending}
                      label={faq.isActive ? t('deactivate') : t('activate')}
                    />
                    <button
                      type="button"
                      onClick={() => openEdit(faq)}
                      title={t('edit')}
                      aria-label={t('edit')}
                      className="ms-2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(faq.id)}
                      title={t('delete')}
                      aria-label={t('delete')}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Create / Edit Modal */}
      <AdminModal
        open={showForm}
        onClose={closeForm}
        title={editingId ? t('editFaq') : t('addNew')}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="faq-question" className="block text-sm font-medium mb-1">
              {t('question')}
            </label>
            <input
              id="faq-question"
              type="text"
              dir="ltr"
              required
              maxLength={500}
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="faq-question-ar" className="block text-sm font-medium mb-1">
              {t('questionAr')}
            </label>
            <input
              id="faq-question-ar"
              type="text"
              dir="rtl"
              maxLength={500}
              value={form.questionAr}
              onChange={(e) => setForm((f) => ({ ...f, questionAr: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="faq-answer" className="block text-sm font-medium mb-1">
              {t('answer')}
            </label>
            <textarea
              id="faq-answer"
              dir="ltr"
              required
              rows={4}
              maxLength={10000}
              value={form.answer}
              onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              className={cn(inputCls, 'resize-y')}
            />
          </div>

          <div>
            <label htmlFor="faq-answer-ar" className="block text-sm font-medium mb-1">
              {t('answerAr')}
            </label>
            <textarea
              id="faq-answer-ar"
              dir="rtl"
              rows={4}
              maxLength={10000}
              value={form.answerAr}
              onChange={(e) => setForm((f) => ({ ...f, answerAr: e.target.value }))}
              className={cn(inputCls, 'resize-y')}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 p-3">
            <div>
              <p className="text-sm font-medium">{form.isActive ? t('active') : t('inactive')}</p>
              <p className="text-xs text-muted-foreground">{t('activeHint')}</p>
            </div>
            <Toggle
              checked={form.isActive}
              onChange={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              label={form.isActive ? t('deactivate') : t('activate')}
            />
          </div>

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
      </AdminModal>

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
