'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Copy, Check, Hash, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownMessage } from '@/components/ui/MarkdownMessage';
import type { Message } from '@/hooks/useConversations';
import { getMediaUrl, relativeTime, ROLE_ICON } from '../_lib/constants';

interface MessageBubbleProps {
  message: Message;
  copiedMessageId: string | null;
  onCopy: (id: string, content: string, contentType?: string, mediaUrl?: string) => void;
}

export const MessageBubble = React.memo(function MessageBubble({
  message: msg,
  copiedMessageId,
  onCopy,
}: MessageBubbleProps) {
  const t = useTranslations('dashboard.conversations');
  const isCustomer = msg.role === 'CUSTOMER';
  const isSystem = msg.role === 'SYSTEM';
  const isInternalEscalation = isSystem && msg.metadata?.visibility === 'internal';
  const RoleIcon = ROLE_ICON[msg.role] ?? Hash;
  const mediaUrl = msg.contentType !== 'TEXT' ? getMediaUrl(msg.content, msg.metadata) : undefined;

  // System messages — centered, distinct styling
  if (isSystem) {
    return (
      <div className="group mb-4 flex justify-center">
        <div
          className={cn(
            'max-w-[85%] rounded-lg px-4 py-2 text-center text-xs',
            isInternalEscalation
              ? 'border border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <div className="flex items-center justify-center gap-1.5">
            {isInternalEscalation ? (
              <ArrowRightLeft className="h-3 w-3" />
            ) : (
              <Hash className="h-3 w-3" />
            )}
            <span>{msg.content}</span>
          </div>
          {isInternalEscalation && msg.metadata?.reason && (
            <p className="mt-1 text-[10px] opacity-70">
              {t('escalationReason')}: {msg.metadata.reason}
            </p>
          )}
          <p className="mt-1 text-[10px] opacity-50">{relativeTime(msg.createdAt, t)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('group mb-4 flex', isCustomer ? 'justify-start' : 'justify-end')}>
      <div className={cn('max-w-[75%]', isCustomer ? 'items-start' : 'items-end')}>
        <div
          className={cn(
            'relative rounded-lg p-3',
            isCustomer
              ? 'rounded-bl-sm bg-muted'
              : 'rounded-br-sm bg-primary text-primary-foreground',
          )}
        >
          {/* Copy button */}
          <button
            onClick={() => onCopy(msg.id, msg.content, msg.contentType, mediaUrl)}
            className={cn(
              'absolute top-2 end-2 z-10 flex h-6 w-6 items-center justify-center rounded-lg opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100',
              isCustomer
                ? 'bg-foreground/5 text-muted-foreground hover:bg-foreground/10'
                : 'bg-primary-foreground/10 text-primary-foreground/70 hover:bg-primary-foreground/20',
            )}
            title={copiedMessageId === msg.id ? t('copied') : t('copyMessage')}
            aria-label={copiedMessageId === msg.id ? t('copied') : t('copyMessage')}
          >
            {copiedMessageId === msg.id ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>

          {/* Role badge */}
          <div
            className={cn(
              'mb-1 flex items-center gap-1 text-[10px] font-medium',
              isCustomer ? 'text-muted-foreground' : 'text-primary-foreground/70',
            )}
          >
            <RoleIcon className="h-3 w-3" />
            <span>
              {msg.role === 'AI_AGENT'
                ? t('roleAI')
                : msg.role === 'CUSTOMER'
                  ? t('roleCustomer')
                  : msg.role === 'HUMAN_AGENT'
                    ? t('roleAgent')
                    : t('roleSystem')}
            </span>
          </div>

          {/* Content */}
          {msg.contentType === 'IMAGE' ? (
            <a
              href={getMediaUrl(msg.content, msg.metadata)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={getMediaUrl(msg.content, msg.metadata)}
                alt=""
                className="max-w-full max-h-64 rounded-lg object-contain"
                loading="lazy"
              />
            </a>
          ) : msg.contentType === 'VIDEO' ? (
            <video
              src={getMediaUrl(msg.content, msg.metadata)}
              controls
              className="max-w-full max-h-64 rounded-lg"
            />
          ) : msg.contentType === 'AUDIO' ? (
            <audio src={getMediaUrl(msg.content, msg.metadata)} controls className="w-full" />
          ) : msg.contentType === 'DOCUMENT' ? (
            <a
              href={getMediaUrl(msg.content, msg.metadata)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm underline"
            >
              <FileText className="h-4 w-4" />
              {msg.content.split('/').pop() || msg.content}
            </a>
          ) : msg.role === 'AI_AGENT' ? (
            <MarkdownMessage content={msg.content} />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
          )}
        </div>

        {/* Timestamp */}
        <p
          className={cn(
            'mt-1 text-xs text-muted-foreground',
            isCustomer ? 'text-start' : 'text-end',
          )}
        >
          {relativeTime(msg.createdAt, t)}
        </p>
      </div>
    </div>
  );
});
