'use client';

import React, { useState, FormEvent } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { fmtDate } from '@/lib/dateFormat';
import {
  BookOpen,
  Plus,
  Trash2,
  FileText,
  ArrowLeft,
  Loader2,
  Upload,
  Globe,
  ChevronDown,
  Pencil,
  Save,
  X as XIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useKnowledgeBases,
  useKnowledgeBase,
  useCreateKnowledgeBase,
  useUpdateKnowledgeBase,
  useDeleteKnowledgeBase,
  useAddDocument,
  useDeleteDocument,
  type KnowledgeBase,
  type KBDocument,
} from '@/hooks/useKnowledgeBase';
import { StatusBadge } from './_components/StatusBadge';
import { ContentTypeBadge } from './_components/ContentTypeBadge';

// ---------------------------------------------------------------------------
// KB List View
// ---------------------------------------------------------------------------

function KBListView({
  knowledgeBases,
  isLoading,
  onSelect,
  onShowCreate,
  showCreateForm,
  onHideCreate,
}: {
  knowledgeBases: KnowledgeBase[] | undefined;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onShowCreate: () => void;
  showCreateForm: boolean;
  onHideCreate: () => void;
}) {
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

// ---------------------------------------------------------------------------
// KB Detail View
// ---------------------------------------------------------------------------

function KBDetailView({
  kbId,
  onBack,
}: {
  kbId: string;
  onBack: () => void;
}) {
  const t = useTranslations('dashboard.knowledgeBase');
  const tc = useTranslations('common');
  const locale = useLocale();

  const { data: kb, isLoading } = useKnowledgeBase(kbId);

  // Edit KB state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const updateKbMutation = useUpdateKnowledgeBase();

  // Add document form state
  const [showAddDocForm, setShowAddDocForm] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docContentType, setDocContentType] = useState<'TEXT' | 'FAQ' | 'PDF' | 'URL'>('TEXT');
  const [docSourceUrl, setDocSourceUrl] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  const statusLabels: Record<string, string> = {
    PENDING: t('statusPending'),
    PROCESSING: t('statusProcessing'),
    COMPLETED: t('statusCompleted'),
    FAILED: t('statusFailed'),
  };
  const contentTypeLabels: Record<string, string> = {
    TEXT: t('contentTypeText'),
    FAQ: t('contentTypeFaq'),
    PDF: t('contentTypePdf'),
    URL: t('contentTypeUrl'),
  };

  const addDocMutation = useAddDocument();
  const deleteDocMutation = useDeleteDocument();

  function startEditing() {
    if (!kb) return;
    setEditName(kb.name);
    setEditDescription(kb.description || '');
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditName('');
    setEditDescription('');
  }

  function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    updateKbMutation.mutate(
      { kbId, name: editName.trim(), description: editDescription.trim() || undefined },
      { onSuccess: () => setIsEditing(false) },
    );
  }

  function handleAddDocument(e: FormEvent) {
    e.preventDefault();
    if (!docTitle.trim()) return;

    if (docContentType === 'PDF') {
      if (!pdfFile) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        addDocMutation.mutate(
          {
            kbId,
            title: docTitle.trim(),
            contentType: 'PDF',
            fileBase64: base64,
          },
          { onSuccess: resetForm },
        );
      };
      reader.readAsDataURL(pdfFile);
      return;
    }

    if (docContentType === 'URL') {
      if (!docSourceUrl.trim()) return;
      addDocMutation.mutate(
        {
          kbId,
          title: docTitle.trim(),
          contentType: 'URL',
          sourceUrl: docSourceUrl.trim(),
        },
        { onSuccess: resetForm },
      );
      return;
    }

    if (!docContent.trim()) return;
    addDocMutation.mutate(
      {
        kbId,
        title: docTitle.trim(),
        content: docContent.trim(),
        contentType: docContentType,
        sourceUrl: docSourceUrl.trim() || undefined,
      },
      { onSuccess: resetForm },
    );
  }

  function resetForm() {
    setDocTitle('');
    setDocContent('');
    setDocContentType('TEXT');
    setDocSourceUrl('');
    setPdfFile(null);
    setShowAddDocForm(false);
  }

  function handleDeleteDocument(docId: string) {
    deleteDocMutation.mutate(
      { kbId, docId },
      { onSuccess: () => setConfirmDeleteDocId(null) },
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
        <p className="text-muted-foreground">{tc('error')}</p>
        <button
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {tc('back')}
        </button>
      </div>
    );
  }

  const documents = kb.documents ?? [];

  return (
    <div>
      {/* Back button + header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {tc('back')}
        </button>

        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
            <div>
              <label htmlFor="edit-kb-name" className="block text-sm font-medium mb-1">
                {t('name')} <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-kb-name"
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="edit-kb-desc" className="block text-sm font-medium mb-1">
                {t('description')}
              </label>
              <input
                id="edit-kb-desc"
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={updateKbMutation.isPending || !editName.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {updateKbMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {tc('save')}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                <XIcon className="h-3.5 w-3.5" />
                {tc('cancel')}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{kb.name}</h1>
                <button
                  onClick={startEditing}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label={tc('edit')}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {kb.description && (
                <p className="text-muted-foreground mt-1">{kb.description}</p>
              )}
            </div>
            {!showAddDocForm && (
              <button
                onClick={() => setShowAddDocForm(true)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 shrink-0 transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t('addDocument')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add document form */}
      {showAddDocForm && (
        <form
          onSubmit={handleAddDocument}
          className="mb-6 rounded-xl border bg-card p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold mb-4">{t('addDocument')}</h2>

          <div className="space-y-4">
            {/* Content Type Selector */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('contentType')}
              </label>
              <div className="flex flex-wrap gap-2">
                {(['TEXT', 'FAQ', 'PDF', 'URL'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDocContentType(type)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors border',
                      docContentType === type
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground hover:bg-muted border-border',
                    )}
                  >
                    {type === 'PDF' && <Upload className="h-3.5 w-3.5" />}
                    {type === 'URL' && <Globe className="h-3.5 w-3.5" />}
                    {type === 'TEXT' && <FileText className="h-3.5 w-3.5" />}
                    {type === 'FAQ' && <FileText className="h-3.5 w-3.5" />}
                    {t(`contentType${type[0]}${type.slice(1).toLowerCase()}` as any)}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="doc-title" className="block text-sm font-medium mb-1">
                {t('documentTitle')} <span className="text-red-500">*</span>
              </label>
              <input
                id="doc-title"
                type="text"
                required
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder={t('documentTitlePlaceholder')}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* PDF Upload */}
            {docContentType === 'PDF' && (
              <div>
                <label htmlFor="doc-pdf" className="block text-sm font-medium mb-1">
                  {t('pdfFile')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="doc-pdf"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
                  />
                </div>
                {pdfFile && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pdfFile.name} ({(pdfFile.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </div>
            )}

            {/* URL Input */}
            {docContentType === 'URL' && (
              <div>
                <label htmlFor="doc-url" className="block text-sm font-medium mb-1">
                  {t('websiteUrl')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="doc-url"
                  type="url"
                  required
                  value={docSourceUrl}
                  onChange={(e) => setDocSourceUrl(e.target.value)}
                  placeholder="https://example.com/page"
                  dir="ltr"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('urlHint')}
                </p>
              </div>
            )}

            {/* Text Content (TEXT and FAQ only) */}
            {(docContentType === 'TEXT' || docContentType === 'FAQ') && (
              <div>
                <label htmlFor="doc-content" className="block text-sm font-medium mb-1">
                  {t('documentContent')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="doc-content"
                  required
                  rows={6}
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  placeholder={t('documentContentPlaceholder')}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              type="submit"
              disabled={addDocMutation.isPending || !docTitle.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addDocMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('addDocument')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              {tc('cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {documents.length === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t('noDocuments')}</p>
        </div>
      )}

      {/* Documents table */}
      {documents.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-start px-4 py-3 font-medium">{t('documentTitle')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('contentType')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('status')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('chunks')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('date')}</th>
                  <th className="text-end px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const isExpanded = expandedDocId === doc.id;
                  return (
                    <React.Fragment key={doc.id}>
                      <tr
                        className={cn(
                          'hover:bg-muted/30 transition-colors cursor-pointer',
                          isExpanded ? 'bg-muted/20' : 'border-b last:border-b-0',
                        )}
                        onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                      >
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              className={cn(
                                'h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform',
                                isExpanded && 'rotate-180',
                              )}
                            />
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[200px]">{doc.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <ContentTypeBadge type={doc.contentType} label={contentTypeLabels[doc.contentType] || doc.contentType} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={doc.embeddingStatus} label={statusLabels[doc.embeddingStatus] || doc.embeddingStatus} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {doc.chunkCount ?? 0}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {fmtDate(doc.createdAt, locale)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {confirmDeleteDocId === doc.id ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  disabled={deleteDocMutation.isPending}
                                  className="inline-flex items-center gap-1 rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                                >
                                  {deleteDocMutation.isPending && (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  )}
                                  {tc('confirm')}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteDocId(null)}
                                  className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
                                >
                                  {tc('cancel')}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteDocId(doc.id)}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                aria-label={tc('delete')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b">
                          <td colSpan={6} className="p-0">
                            <div className="bg-muted/10 px-4 py-4 border-t">
                              {doc.sourceUrl && (
                                <div className="mb-3">
                                  <span className="text-xs font-medium text-muted-foreground">{t('source')}:</span>{' '}
                                  <a
                                    href={doc.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                    dir="ltr"
                                  >
                                    {doc.sourceUrl}
                                  </a>
                                </div>
                              )}
                              <div className="rounded-lg border bg-background p-4 max-h-80 overflow-y-auto">
                                <pre className="text-sm whitespace-pre-wrap break-words text-foreground">
                                  {doc.content || t('noContent')}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function KnowledgeBasePage() {
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: knowledgeBases, isLoading } = useKnowledgeBases();

  if (selectedKbId) {
    return (
      <KBDetailView
        kbId={selectedKbId}
        onBack={() => setSelectedKbId(null)}
      />
    );
  }

  return (
    <KBListView
      knowledgeBases={knowledgeBases}
      isLoading={isLoading}
      onSelect={(id) => setSelectedKbId(id)}
      onShowCreate={() => setShowCreateForm(true)}
      showCreateForm={showCreateForm}
      onHideCreate={() => setShowCreateForm(false)}
    />
  );
}
