'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, ImagePlus, Loader2, FileText } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const user = useAuthStore((s) => s.user);

  // Detect "/" to open template picker
  function handleChange(newValue: string) {
    // Check if "/" was just typed at the start or after a space
    if (newValue.endsWith('/') && (newValue.length === 1 || newValue[newValue.length - 2] === ' ')) {
      setShowTemplates(true);
      // Remove the "/" from the input
      onChange(newValue.slice(0, -1));
      return;
    }

    onChange(newValue);
    onTyping(newValue.length > 0);
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

        <div className="flex items-end gap-3">
          {/* Template button */}
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

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('messagePlaceholder')}
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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
      </div>

      {/* Template Picker Dialog */}
      <Dialog
        open={showTemplates}
        onOpenChange={setShowTemplates}
        size="xl"
      >
        <TemplatePicker
          conversationId={conversationId || undefined}
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplates(false)}
        />
      </Dialog>
    </>
  );
}
