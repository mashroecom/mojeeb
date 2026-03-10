'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import {
  useMessageTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  type MessageTemplate,
  type CreateTemplateInput,
  type TemplateVariable,
  type AutoTrigger,
} from '@/hooks/useMessageTemplates';
import { useAgents } from '@/hooks/useAgents';
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
  Copy,
  Eye,
  Hash,
  ToggleLeft,
  ToggleRight,
  Tag,
  Variable,
} from 'lucide-react';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';

const CATEGORIES = ['greeting', 'closing', 'support', 'sales', 'billing', 'general'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  greeting: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  closing: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  support: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  sales: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  billing: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
  general: 'bg-muted text-muted-foreground',
};

const DEFAULT_VARIABLES: TemplateVariable[] = [
  { key: 'customerName', labelEn: 'Customer Name', labelAr: 'اسم العميل' },
  { key: 'companyName', labelEn: 'Company Name', labelAr: 'اسم الشركة' },
  { key: 'agentName', labelEn: 'Agent Name', labelAr: 'اسم الوكيل' },
];

// ────────────────────────────────────────────────────────────────────────────
// Template Form
// ────────────────────────────────────────────────────────────────────────────

function TemplateForm({
  initial,
  onSave,
  onCancel,
  isSaving,
  agents,
}: {
  initial?: MessageTemplate;
  onSave: (data: CreateTemplateInput) => void;
  onCancel: () => void;
  isSaving: boolean;
  agents: { id: string; name: string }[];
}) {
  const t = useTranslations('dashboard.messageTemplates');
  const locale = useLocale();

  const [title, setTitle] = useState(initial?.title || '');
  const [contentEn, setContentEn] = useState(initial?.contentEn || '');
  const [contentAr, setContentAr] = useState(initial?.contentAr || '');
  const [shortcut, setShortcut] = useState(initial?.shortcut || '');
  const [category, setCategory] = useState(initial?.category || 'general');
  const [agentId, setAgentId] = useState(initial?.agentId || '');
  const [isActive, setIsActive] = useState(initial?.isActive !== false);
  const [contentTab, setContentTab] = useState<'en' | 'ar'>(locale === 'ar' ? 'ar' : 'en');
  const [variables, setVariables] = useState<TemplateVariable[]>(
    initial?.variables && Array.isArray(initial.variables) ? initial.variables : [],
  );
  const [autoTrigger, setAutoTrigger] = useState<AutoTrigger>(
    initial?.autoTrigger || { enabled: false, keywords: [] },
  );
  const [keywordInput, setKeywordInput] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [customVarKey, setCustomVarKey] = useState('');
  const [customVarLabelEn, setCustomVarLabelEn] = useState('');
  const [customVarLabelAr, setCustomVarLabelAr] = useState('');

  function insertVariable(key: string) {
    const placeholder = `{{${key}}}`;
    if (contentTab === 'en') {
      setContentEn((prev) => prev + placeholder);
    } else {
      setContentAr((prev) => prev + placeholder);
    }
  }

  function addKeyword() {
    const kw = keywordInput.trim();
    if (kw && !autoTrigger.keywords.includes(kw)) {
      setAutoTrigger({ ...autoTrigger, keywords: [...autoTrigger.keywords, kw] });
    }
    setKeywordInput('');
  }

  function removeKeyword(kw: string) {
    setAutoTrigger({ ...autoTrigger, keywords: autoTrigger.keywords.filter((k) => k !== kw) });
  }

  function addCustomVariable() {
    if (!customVarKey.trim()) return;
    const key = customVarKey.trim().replace(/\s+/g, '');
    if (variables.some((v) => v.key === key) || DEFAULT_VARIABLES.some((v) => v.key === key))
      return;
    setVariables([
      ...variables,
      { key, labelEn: customVarLabelEn.trim() || key, labelAr: customVarLabelAr.trim() },
    ]);
    setCustomVarKey('');
    setCustomVarLabelEn('');
    setCustomVarLabelAr('');
  }

  function removeCustomVariable(key: string) {
    setVariables(variables.filter((v) => v.key !== key));
  }

  // Preview: replace variables with sample values
  const previewContent = useMemo(() => {
    const src = contentTab === 'en' ? contentEn : contentAr;
    return src
      .replace(/\{\{customerName\}\}/g, 'Ahmed')
      .replace(/\{\{companyName\}\}/g, 'Mojeeb')
      .replace(/\{\{agentName\}\}/g, 'Support Bot')
      .replace(/\{\{(\w+)\}\}/g, '[$1]');
  }, [contentEn, contentAr, contentTab]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !contentEn.trim()) return;
    onSave({
      title: title.trim(),
      contentEn: contentEn.trim(),
      contentAr: contentAr.trim(),
      shortcut: shortcut.trim() || null,
      category,
      variables,
      agentId: agentId || null,
      isActive,
      autoTrigger,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-5 space-y-5">
      {/* Row 1: Title + Shortcut + Category + Agent */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t('titleLabel')}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t('shortcut')}</label>
          <div className="relative mt-1">
            <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              /
            </span>
            <input
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              placeholder={t('shortcutPlaceholder')}
              className="w-full rounded-lg border bg-background ps-7 pe-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 font-mono"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t('category')}</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`cat_${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t('agent')}</label>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <option value="">{t('allAgents')}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content tabs (EN / AR) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-muted-foreground">{t('contentLabel')}</label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setContentTab('en')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
                contentTab === 'en'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setContentTab('ar')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
                contentTab === 'ar'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              العربية
            </button>
          </div>
        </div>

        {/* Variable buttons */}
        <div className="flex items-center gap-1 flex-wrap mb-2">
          <span className="text-[10px] text-muted-foreground me-1">
            <Variable className="inline h-3 w-3" /> {t('insertVariable')}:
          </span>
          {DEFAULT_VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded hover:bg-accent transition-colors"
            >
              {`{{${v.key}}}`}
            </button>
          ))}
          {variables.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              className="text-[10px] font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              {`{{${v.key}}}`}
            </button>
          ))}
        </div>

        <textarea
          value={contentTab === 'en' ? contentEn : contentAr}
          onChange={(e) =>
            contentTab === 'en' ? setContentEn(e.target.value) : setContentAr(e.target.value)
          }
          placeholder={contentTab === 'en' ? t('contentPlaceholderEn') : t('contentPlaceholderAr')}
          rows={4}
          dir={contentTab === 'ar' ? 'rtl' : 'ltr'}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 resize-none"
          required={contentTab === 'en'}
        />

        {/* Preview toggle */}
        {(contentEn || contentAr) && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Eye className="h-3 w-3" />
              {t('preview')}
            </button>
            {showPreview && (
              <div
                className="mt-2 rounded-lg border bg-muted/50 p-3 text-sm whitespace-pre-wrap"
                dir={contentTab === 'ar' ? 'rtl' : 'ltr'}
              >
                {previewContent || <span className="text-muted-foreground">{t('noContent')}</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Variables */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">{t('customVariables')}</label>
        {variables.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
            {variables.map((v) => (
              <span
                key={v.key}
                className="inline-flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full"
              >
                {`{{${v.key}}}`} - {locale === 'ar' && v.labelAr ? v.labelAr : v.labelEn}
                <button
                  type="button"
                  onClick={() => removeCustomVariable(v.key)}
                  className="hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 mt-1">
          <input
            value={customVarKey}
            onChange={(e) => setCustomVarKey(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
            placeholder={t('varKeyPlaceholder')}
            className="w-28 rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/30 font-mono"
          />
          <input
            value={customVarLabelEn}
            onChange={(e) => setCustomVarLabelEn(e.target.value)}
            placeholder={t('varLabelEnPlaceholder')}
            className="w-28 rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          <input
            value={customVarLabelAr}
            onChange={(e) => setCustomVarLabelAr(e.target.value)}
            placeholder={t('varLabelArPlaceholder')}
            dir="rtl"
            className="w-28 rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          <button
            type="button"
            onClick={addCustomVariable}
            disabled={!customVarKey.trim()}
            className="inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {t('addVariable')}
          </button>
        </div>
      </div>

      {/* Auto-trigger */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => setAutoTrigger({ ...autoTrigger, enabled: !autoTrigger.enabled })}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {autoTrigger.enabled ? (
              <ToggleRight className="h-5 w-5 text-primary" />
            ) : (
              <ToggleLeft className="h-5 w-5" />
            )}
          </button>
          <label className="text-xs font-medium text-muted-foreground">{t('autoTrigger')}</label>
        </div>
        {autoTrigger.enabled && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder={t('keywordPlaceholder')}
                className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
              <button
                type="button"
                onClick={addKeyword}
                disabled={!keywordInput.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            {autoTrigger.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {autoTrigger.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      className="hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active toggle + Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <button
          type="button"
          onClick={() => setIsActive(!isActive)}
          className="inline-flex items-center gap-2 text-sm"
        >
          {isActive ? (
            <ToggleRight className="h-5 w-5 text-primary" />
          ) : (
            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
          )}
          <span
            className={cn(
              'text-xs font-medium',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {isActive ? t('active') : t('inactive')}
          </span>
        </button>

        <div className="flex items-center gap-2">
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
            disabled={isSaving || !title.trim() || !contentEn.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {t('save')}
          </button>
        </div>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────────────────

export default function MessageTemplatesPage() {
  const t = useTranslations('dashboard.messageTemplates');
  const tc = useTranslations('common');
  const ts = useTranslations('dashboard.sidebar');
  const tb = useTranslations('dashboard.breadcrumb');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  const { data: templates, isLoading, isError, refetch: refetchTemplates } = useMessageTemplates();
  const { data: agents } = useAgents();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const { confirmProps, confirm } = useConfirmDialog();

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!templates) return [];
    return templates.filter((tpl) => {
      if (categoryFilter && tpl.category !== categoryFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        tpl.title.toLowerCase().includes(q) ||
        tpl.contentEn.toLowerCase().includes(q) ||
        tpl.contentAr.toLowerCase().includes(q) ||
        (tpl.shortcut && tpl.shortcut.toLowerCase().includes(q))
      );
    });
  }, [templates, search, categoryFilter]);

  // Category counts
  const categoryCounts = useMemo(() => {
    if (!templates) return {};
    const counts: Record<string, number> = {};
    for (const tpl of templates) {
      counts[tpl.category] = (counts[tpl.category] || 0) + 1;
    }
    return counts;
  }, [templates]);

  function handleCreate(data: CreateTemplateInput) {
    createTemplate.mutate(data, {
      onSuccess: () => {
        addToast('success', t('created'));
        setShowForm(false);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error;
        addToast(
          'error',
          msg === 'Shortcut already exists' ? t('shortcutExists') : t('createFailed'),
        );
      },
    });
  }

  function handleUpdate(data: CreateTemplateInput) {
    if (!editingTemplate) return;
    updateTemplate.mutate(
      { templateId: editingTemplate.id, ...data },
      {
        onSuccess: () => {
          addToast('success', t('updated'));
          setEditingTemplate(null);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error;
          addToast(
            'error',
            msg === 'Shortcut already exists' ? t('shortcutExists') : t('updateFailed'),
          );
        },
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

  function handleDuplicate(template: MessageTemplate) {
    createTemplate.mutate(
      {
        title: `${template.title} (copy)`,
        contentEn: template.contentEn,
        contentAr: template.contentAr,
        category: template.category,
        variables: template.variables,
        agentId: template.agentId,
        isActive: template.isActive,
        autoTrigger: template.autoTrigger,
      },
      {
        onSuccess: () => addToast('success', t('duplicated')),
        onError: () => addToast('error', t('createFailed')),
      },
    );
  }

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
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {tc('tryAgain')}
        </button>
      </div>
    );
  }

  const agentList = (agents || []).map((a) => ({ id: a.id, name: a.name }));

  return (
    <div>
      <Breadcrumb
        items={[{ label: tb('dashboard'), href: '/dashboard' }, { label: tb('messageTemplates') }]}
        className="mb-4"
      />

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
          onClick={() => {
            setShowForm(true);
            setEditingTemplate(null);
          }}
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
            onCancel={() => {
              setShowForm(false);
              setEditingTemplate(null);
            }}
            isSaving={createTemplate.isPending || updateTemplate.isPending}
            agents={agentList}
          />
        </div>
      )}

      {/* Filters: Search + Category tabs */}
      {templates && templates.length > 0 && (
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-lg border bg-background ps-10 pe-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>

          {/* Category filter tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoryFilter('')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors shrink-0',
                !categoryFilter
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent',
              )}
            >
              <Tag className="h-3 w-3" />
              {t('allCategories')}
              <span className="text-[10px] opacity-70">({templates.length})</span>
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors shrink-0',
                  categoryFilter === c
                    ? 'bg-primary text-primary-foreground'
                    : cn(CATEGORY_COLORS[c], 'hover:opacity-80'),
                )}
              >
                {t(`cat_${c}`)}
                {categoryCounts[c] ? (
                  <span className="text-[10px] opacity-70">({categoryCounts[c]})</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Templates grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className={cn(
                'group rounded-xl border bg-card p-5 transition-colors hover:border-primary/20',
                !tpl.isActive && 'opacity-60',
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold truncate">{tpl.title}</h3>
                <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setEditingTemplate(tpl);
                      setShowForm(false);
                    }}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title={t('editTemplate')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(tpl)}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title={t('duplicate')}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(tpl)}
                    className="text-muted-foreground hover:text-red-500 p-1"
                    title={t('deleteTemplate')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <p
                className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-3"
                dir={locale === 'ar' ? 'rtl' : 'ltr'}
              >
                {locale === 'ar' && tpl.contentAr ? tpl.contentAr : tpl.contentEn}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    'text-[10px] font-medium px-2 py-0.5 rounded-full',
                    CATEGORY_COLORS[tpl.category] || CATEGORY_COLORS.general,
                  )}
                >
                  {t(`cat_${tpl.category}` as any)}
                </span>
                {tpl.shortcut && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    <Zap className="h-2.5 w-2.5" />/{tpl.shortcut}
                  </span>
                )}
                {tpl.usageCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    <Hash className="h-2.5 w-2.5" />
                    {tpl.usageCount}
                  </span>
                )}
                {!tpl.isActive && (
                  <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {t('inactive')}
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
