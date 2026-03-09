'use client';

import { useState, FormEvent } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import {
  BookOpen,
  Plus,
  Trash2,
  FileText,
  Loader2,
  Pencil,
  Save,
} from 'lucide-react';
import {
  useCreateKnowledgeBase,
  useUpdateKnowledgeBase,
  useDeleteKnowledgeBase,
  type KnowledgeBase,
} from '@/hooks/useKnowledgeBase';

interface KBListViewProps {
  knowledgeBases: KnowledgeBase[] | undefined;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onShowCreate: () => void;
  showCreateForm: boolean;
  onHideCreate: () => void;
}

export function KBListView({
  knowledgeBases,
  isLoading,
  onSelect,
  onShowCreate,
  showCreateForm,
  onHideCreate,
}: KBListViewProps) {
  const t = useTranslations('dashboard.knowledgeBase');
  const tc = useTranslations('common');
  const locale = useLocale();

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Edit state
  const [editingKbId, setEditingKbId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const createMutation = useCreateKnowledgeBase();
  const deleteMutation = useDeleteKnowledgeBase();
  const updateMutation = useUpdateKnowledgeBase();

  function startEditing(kb: KnowledgeBase) {
    setEditingKbId(kb.id);
    setEditName(kb.name);
    setEditDescription(kb.description || '');
  }

  function cancelEditing() {
    setEditingKbId(null);
    setEditName('');
    setEditDescription('');
  }

  function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingKbId || !editName.trim()) return;
    updateMutation.mutate(
      { kbId: editingKbId, name: editName.trim(), description: editDescription.trim() || undefined },
      { onSuccess: () => cancelEditing() },
    );
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      {
        onSuccess: () => {
          setName('');
          setDescription('');
          onHideCreate();
        },
      },
    );
  }

  function handleDelete(kbId: string) {
    deleteMutation.mutate(kbId, {
      onSuccess: () => setConfirmDeleteId(null),
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        {!showCreateForm && (
          <button
            onClick={onShowCreate}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('createKb')}
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border bg-card p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold mb-4">{t('createKb')}</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="kb-name" className="block text-sm font-medium mb-1">
                {t('name')} <span className="text-red-500">*</span>
              </label>
              <input
                id="kb-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="kb-description" className="block text-sm font-medium mb-1">
                {t('description')}
              </label>
              <input
                id="kb-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('create')}
            </button>
            <button
              type="button"
              onClick={() => {
                setName('');
                setDescription('');
                onHideCreate();
              }}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              {tc('cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!knowledgeBases || knowledgeBases.length === 0) && (
        <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t('noKb')}</p>
        </div>
      )}

      {/* KB Grid */}
      {!isLoading && knowledgeBases && knowledgeBases.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {knowledgeBases.map((kb) => (
            <div
              key={kb.id}
              className="group relative rounded-xl border bg-card p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSelect(kb.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{kb.name}</h3>
                    {kb.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {kb.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Edit & Delete buttons */}
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(kb);
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label={tc('edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(kb.id);
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    aria-label={tc('delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {kb._count?.documents ?? 0} {t('documents')}
                </span>
                <span>{fmtDate(kb.createdAt, locale)}</span>
              </div>

              {/* Delete confirm dialog */}
              {confirmDeleteId === kb.id && (
                <div
                  className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/95 backdrop-blur-sm p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-center">
                    <p className="text-sm font-medium mb-3">{t('deleteKbConfirm')}</p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleDelete(kb.id)}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                      >
                        {deleteMutation.isPending && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        {tc('delete')}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
                      >
                        {tc('cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit overlay */}
              {editingKbId === kb.id && (
                <div
                  className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/95 backdrop-blur-sm p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <form onSubmit={handleSaveEdit} className="w-full space-y-3">
                    <div>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder={t('namePlaceholder')}
                        className="w-full rounded-md border bg-background px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                        autoFocus
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder={t('descriptionPlaceholder')}
                        className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="submit"
                        disabled={updateMutation.isPending || !editName.trim()}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        {tc('save')}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
                      >
                        {tc('cancel')}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
