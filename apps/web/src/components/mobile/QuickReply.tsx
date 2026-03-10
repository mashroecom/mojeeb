'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, Search, Send, Zap, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMessageTemplates, type MessageTemplate } from '@/hooks/useMessageTemplates';

/* ── Constants ─────────────────────────────────────────────── */
const CATEGORIES = [
  { value: '', labelKey: 'all' },
  { value: 'greeting', labelKey: 'greeting' },
  { value: 'troubleshooting', labelKey: 'troubleshooting' },
  { value: 'closing', labelKey: 'closing' },
  { value: 'product_info', labelKey: 'productInfo' },
  { value: 'escalation', labelKey: 'escalation' },
  { value: 'feedback', labelKey: 'feedback' },
];

/* ── Props ─────────────────────────────────────────────────── */
interface QuickReplyProps {
  open: boolean;
  conversationId?: string;
  customerName?: string | null;
  onSend: (message: string) => Promise<void> | void;
  onClose: () => void;
}

/* ── Component ─────────────────────────────────────────────── */
export function QuickReply({
  open,
  conversationId,
  customerName,
  onSend,
  onClose,
}: QuickReplyProps) {
  const t = useTranslations('mobile.quickReply');
  const tc = useTranslations('common');
  const locale = useLocale();

  /* ── Local state ────────────────────────────────────────── */
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [isSending, setIsSending] = useState(false);

  /* ── Data hooks ─────────────────────────────────────────── */
  const { data: templates = [], isLoading } = useMessageTemplates({
    category: category || undefined,
    search: search || undefined,
  });

  /* ── Filtered templates ─────────────────────────────────── */
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => tpl.isActive);
  }, [templates]);

  /* ── Helpers ────────────────────────────────────────────── */
  function getTemplateContent(template: MessageTemplate): string {
    return locale === 'ar' && template.contentAr
      ? template.contentAr
      : template.contentEn;
  }

  function getTemplateTitle(template: MessageTemplate): string {
    return locale === 'ar' && template.titleAr
      ? template.titleAr
      : template.title;
  }

  function interpolateVariables(content: string): string {
    let result = content;

    // Replace customer_name variable
    if (customerName) {
      result = result.replace(/\{\{customer_name\}\}/g, customerName);
    }

    // Replace conversation_id variable
    if (conversationId) {
      result = result.replace(/\{\{conversation_id\}\}/g, conversationId);
    }

    return result;
  }

  /* ── Handlers ───────────────────────────────────────────── */
  async function handleSend() {
    if (!selectedTemplate) return;

    setIsSending(true);
    try {
      const content = getTemplateContent(selectedTemplate);
      const interpolatedContent = interpolateVariables(content);
      await onSend(interpolatedContent);
      handleClose();
    } catch (error) {
      console.error('Failed to send quick reply:', error);
    } finally {
      setIsSending(false);
    }
  }

  function handleClose() {
    setSearch('');
    setCategory('');
    setSelectedTemplate(null);
    onClose();
  }

  function handleTemplateSelect(template: MessageTemplate) {
    setSelectedTemplate(template);
  }

  /* ── Render template item ───────────────────────────────── */
  function renderTemplateItem(template: MessageTemplate) {
    const isSelected = selectedTemplate?.id === template.id;
    const title = getTemplateTitle(template);
    const content = getTemplateContent(template);
    const interpolatedContent = interpolateVariables(content);

    return (
      <button
        key={template.id}
        onClick={() => handleTemplateSelect(template)}
        className={cn(
          'w-full text-start p-4 rounded-lg border transition-colors',
          isSelected
            ? 'border-primary bg-primary/5'
            : 'border-border bg-card hover:bg-muted/30',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-sm truncate flex-1">{title}</h3>
          {template.shortcut && (
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
              {template.shortcut}
            </span>
          )}
        </div>

        {/* Content preview */}
        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
          {interpolatedContent}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="capitalize">{template.category.replace('_', ' ')}</span>
          {template.usageCount > 0 && (
            <span>{template.usageCount} uses</span>
          )}
        </div>
      </button>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-[100] rounded-t-2xl border-t bg-card shadow-2xl',
            'max-h-[85vh] flex flex-col',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-full',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-full',
          )}
        >
          {/* Header */}
          <div className="shrink-0 border-b">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <DialogPrimitive.Title className="text-lg font-semibold">
                  {t('title')}
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                  'text-muted-foreground hover:text-foreground hover:bg-muted',
                  'focus:outline-none focus:ring-2 focus:ring-ring',
                )}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>

            {/* Search bar */}
            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border bg-background ps-10 pe-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* Category tabs */}
            <div className="px-4 pb-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={cn(
                      'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      category === cat.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    )}
                  >
                    {t(`categories.${cat.labelKey}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Templates list */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {isLoading ? (
              /* Loading skeleton */
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg border bg-card p-4 animate-pulse"
                  >
                    <div className="h-4 w-32 bg-muted rounded mb-2" />
                    <div className="h-3 w-full bg-muted rounded mb-1" />
                    <div className="h-3 w-3/4 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : filteredTemplates.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mb-3 opacity-40" />
                <p className="text-sm font-medium mb-1">{t('noTemplates')}</p>
                <p className="text-xs text-center">{t('noTemplatesHint')}</p>
              </div>
            ) : (
              /* Template items */
              <div className="space-y-3">
                {filteredTemplates.map(renderTemplateItem)}
              </div>
            )}
          </div>

          {/* Footer with send button */}
          {selectedTemplate && (
            <div className="shrink-0 border-t p-4 bg-muted/30">
              <button
                onClick={handleSend}
                disabled={isSending}
                className={cn(
                  'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                <Send className="h-4 w-4" />
                {isSending ? t('sending') : t('send')}
              </button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
