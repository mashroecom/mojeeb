'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Send, ImagePlus, Loader2, FileText, Zap } from 'lucide-react';
import { useMessageTemplates, type MessageTemplate } from '@/hooks/useMessageTemplates';
import { TemplatePicker, type Template } from '@/components/templates/TemplatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onTyping: (isTyping: boolean) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isSending: boolean;
  isUploading: boolean;
  conversationId?: string | null;
  customerName?: string | null;
}

export function MessageInput({
  value,
  onChange,
  onSend,
  onKeyDown,
  onTyping,
  onFileUpload,
  isSending,
  isUploading,
  conversationId,
  customerName,
}: MessageInputProps) {
  const t = useTranslations('dashboard.conversations');
  const locale = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [slashFilter, setSlashFilter] = useState<string | null>(null);
  const { data: templates } = useMessageTemplates();
  const user = useAuthStore((s) => s.user);

  // Auto-resize textarea based on content
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  // Detect /shortcut typing for autocomplete
  useEffect(() => {
    if (value.startsWith('/') && value.length > 1 && !value.includes(' ')) {
      setSlashFilter(value.slice(1).toLowerCase());
    } else {
      setSlashFilter(null);
    }
  }, [value]);

  // Filtered templates for slash autocomplete
  const slashMatches = useMemo(() => {
    if (slashFilter === null || !templates) return [];
    return templates
      .filter(
        (tpl) => tpl.shortcut && tpl.isActive && tpl.shortcut.toLowerCase().startsWith(slashFilter),
      )
      .slice(0, 5);
  }, [slashFilter, templates]);

  function getContent(tpl: MessageTemplate) {
    return locale === 'ar' && tpl.contentAr ? tpl.contentAr : tpl.contentEn;
  }

  function insertTemplate(tpl: MessageTemplate) {
    onChange(getContent(tpl));
    onTyping(true);
    setShowTemplates(false);
    setSlashFilter(null);
  }

  // Interpolate variables in template content
  function interpolateTemplate(template: Template): string {
    let content = template.content;

    // Build variables object
    const variables: Record<string, string> = {
      customer_name: customerName || '{{customer_name}}',
      agent_name: user ? `${user.firstName} ${user.lastName}`.trim() : '{{agent_name}}',
      conversation_id: conversationId || '{{conversation_id}}',
      order_number: '{{order_number}}', // Not available in current context
    };

    // Replace all variables in the template
    template.variables.forEach((varName) => {
      const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
      const replacement = variables[varName] || `{{${varName}}}`;
      content = content.replace(regex, replacement);
    });

    return content;
  }

  function handleTemplateSelect(template: Template) {
    const interpolated = interpolateTemplate(template);
    onChange(interpolated);
    onTyping(true);
    setShowTemplates(false);

    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // If slash autocomplete is showing and user presses Tab or Enter, insert match
    if (slashMatches.length > 0 && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey))) {
      e.preventDefault();
      insertTemplate(slashMatches[0]);
      return;
    }
    onKeyDown(e);
  }

  const activeTemplates = useMemo(() => {
    return (templates || []).filter((tpl) => tpl.isActive);
  }, [templates]);

  return (
    <>
      <div className="border-t bg-card px-3 md:px-5 py-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          onChange={onFileUpload}
          className="hidden"
        />

        {/* Slash autocomplete popup */}
        {slashMatches.length > 0 && (
          <div className="mb-2 max-h-48 overflow-y-auto rounded-lg border bg-card shadow-lg">
            <div className="p-1">
              {slashMatches.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => insertTemplate(tpl)}
                  className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-start text-sm hover:bg-accent transition-colors"
                >
                  <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">/{tpl.shortcut}</span>
                      <span className="text-[10px] text-muted-foreground">{tpl.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{getContent(tpl)}</p>
                  </div>
                </button>
              ))}
              <p className="px-3 py-1 text-[10px] text-muted-foreground/60">{t('tabInsertHint')}</p>
            </div>
          </div>
        )}

        {/* Template picker popup */}
        {showTemplates && activeTemplates.length > 0 && slashFilter === null && (
          <div className="mb-2 max-h-48 overflow-y-auto rounded-lg border bg-card shadow-lg">
            <div className="p-1">
              {activeTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => insertTemplate(tpl)}
                  className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-start text-sm hover:bg-accent transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs truncate">{tpl.title}</span>
                      {tpl.shortcut && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded">
                          <Zap className="h-2 w-2" />/{tpl.shortcut}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{getContent(tpl)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Template button */}
          {activeTemplates.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className={cn(
                'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-muted',
                showTemplates && 'bg-muted ring-2 ring-primary/40',
              )}
              title={t('templates')}
            >
              <FileText className="h-4 w-4" />
            </button>
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              onTyping(e.target.value.length > 0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('messagePlaceholder')}
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background px-4 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-[height] duration-100"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            title={t('uploadImage')}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={onSend}
            disabled={!value.trim() || isSending}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground/60">{t('enterToSend')}</p>
      </div>

      {/* Template Picker Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates} size="xl">
        <TemplatePicker
          conversationId={conversationId || undefined}
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplates(false)}
        />
      </Dialog>
    </>
  );
}
