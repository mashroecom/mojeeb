'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, ImagePlus, Loader2, FileText, Zap } from 'lucide-react';
import { useMessageTemplates, type MessageTemplate } from '@/hooks/useMessageTemplates';
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
}: MessageInputProps) {
  const t = useTranslations('dashboard.conversations');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const { data: templates } = useMessageTemplates();

  function insertTemplate(tpl: MessageTemplate) {
    onChange(tpl.content);
    onTyping(true);
    setShowTemplates(false);
  }

  return (
    <div className="border-t bg-card px-3 md:px-5 py-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
        onChange={onFileUpload}
        className="hidden"
      />

      {/* Template picker popup */}
      {showTemplates && templates && templates.length > 0 && (
        <div className="mb-2 max-h-48 overflow-y-auto rounded-lg border bg-card shadow-lg">
          <div className="p-1">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => insertTemplate(tpl)}
                className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-start text-sm hover:bg-accent transition-colors"
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
                  <p className="text-xs text-muted-foreground truncate">{tpl.content}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-3">
        {/* Template button */}
        {templates && templates.length > 0 && (
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
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            onTyping(e.target.value.length > 0);
          }}
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
  );
}
