'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, Search, Send, Zap, FileText, WifiOff, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMessageTemplates, type MessageTemplate } from '@/hooks/useMessageTemplates';
import {
  isOnline,
  queueAction,
  syncQueuedActions,
  setupOnlineListeners,
  type SyncHandler,
} from '@/lib/offlineStorage';

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
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);

  /* ── Data hooks ─────────────────────────────────────────── */
  const { data: templates = [], isLoading } = useMessageTemplates({
    category: category || undefined,
    search: search || undefined,
  });

  /* ── Online/Offline status monitoring ───────────────────── */
  useEffect(() => {
    // Set initial state
    setIsOffline(!isOnline());

    // Create sync handler for queued messages
    const handleSync: SyncHandler = async (action) => {
      if (action.type !== 'send_message') {
        return true;
      }

      try {
        await onSend(action.payload.message);
        return true;
      } catch (error) {
        return false;
      }
    };

    // Setup listeners for online/offline events
    const cleanup = setupOnlineListeners(
      async () => {
        setIsOffline(false);
        // Attempt to sync queued actions when coming back online
        const result = await syncQueuedActions(handleSync);
        if (result.success && result.data && result.data.synced > 0) {
          setQueuedMessage(null);
        }
      },
      () => {
        setIsOffline(true);
      },
    );

    return cleanup;
  }, [onSend]);

  /* ── Filtered templates ─────────────────────────────────── */
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => tpl.isActive);
  }, [templates]);

  /* ── Helpers ────────────────────────────────────────────── */
  function getTemplateContent(template: MessageTemplate): string {
    return locale === 'ar' && template.contentAr ? template.contentAr : template.contentEn;
  }

  function getTemplateTitle(template: MessageTemplate): string {
    return locale === 'ar' && template.titleAr ? template.titleAr : template.title;
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
    if (!selectedTemplate || !conversationId) return;

    setIsSending(true);
    setQueuedMessage(null);

    try {
      const content = getTemplateContent(selectedTemplate);
      const interpolatedContent = interpolateVariables(content);

      // Check if offline before attempting to send
      if (isOffline) {
        // Queue the message for later sync
        const result = await queueAction({
          type: 'send_message',
          conversationId,
          payload: {
            message: interpolatedContent,
          },
        });

        if (result.success) {
          setQueuedMessage(interpolatedContent);
          // Close after a brief delay to show the queued message feedback
          setTimeout(() => {
            handleClose();
          }, 1500);
        }
      } else {
        // Attempt to send immediately
        try {
          await onSend(interpolatedContent);
          handleClose();
        } catch (error) {
          // If send fails, queue it for later
          const result = await queueAction({
            type: 'send_message',
            conversationId,
            payload: {
              message: interpolatedContent,
            },
          });

          if (result.success) {
            setQueuedMessage(interpolatedContent);
            // Close after a brief delay to show the queued message feedback
            setTimeout(() => {
              handleClose();
            }, 1500);
          }
        }
      }
    } finally {
      setIsSending(false);
    }
  }

  function handleClose() {
    setSearch('');
    setCategory('');
    setSelectedTemplate(null);
    setQueuedMessage(null);
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
          isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/30',
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
        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{interpolatedContent}</p>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="capitalize">{template.category.replace('_', ' ')}</span>
          {template.usageCount > 0 && <span>{template.usageCount} uses</span>}
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
                {isOffline && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30">
                    <WifiOff className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                    <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                      {t('offline')}
                    </span>
                  </div>
                )}
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
                  <div key={i} className="rounded-lg border bg-card p-4 animate-pulse">
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
              <div className="space-y-3">{filteredTemplates.map(renderTemplateItem)}</div>
            )}
          </div>

          {/* Footer with send button */}
          {selectedTemplate && (
            <div className="shrink-0 border-t p-4 bg-muted/30">
              {/* Queued message feedback */}
              {queuedMessage && (
                <div className="mb-3 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-medium">
                      {isOffline ? t('queuedForSync') : t('queued')}
                    </p>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1 ms-6">
                    {t('willSyncWhenOnline')}
                  </p>
                </div>
              )}

              <button
                onClick={handleSend}
                disabled={isSending || !!queuedMessage}
                className={cn(
                  'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                <Send className="h-4 w-4" />
                {isSending ? t('sending') : isOffline ? t('queueMessage') : t('send')}
              </button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
