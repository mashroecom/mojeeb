'use client';

import { use, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { fmtDateTime } from '@/lib/dateFormat';
import {
  useAdminConversationDetail,
  useUpdateAdminConversation,
} from '@/hooks/useAdmin';
import { useToastStore } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  User,
  Mail,
  Phone,
  Building2,
  Radio,
  Tag,
  Star,
  StickyNote,
  Bot,
  Headphones,
  Info,
} from 'lucide-react';

/* ── Status badge colours ─────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  HANDED_OFF: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  WAITING:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  RESOLVED:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ARCHIVED:   'bg-muted text-muted-foreground',
};

const STATUS_OPTIONS = ['ACTIVE', 'HANDED_OFF', 'WAITING', 'RESOLVED', 'ARCHIVED'] as const;

/* ── Message bubble colours by role ───────────────────────── */
const ROLE_BUBBLE: Record<string, string> = {
  CUSTOMER:    'bg-blue-50 dark:bg-blue-950',
  AI_AGENT:    'bg-green-50 dark:bg-green-950',
  HUMAN_AGENT: 'bg-purple-50 dark:bg-purple-950',
  SYSTEM:      'bg-muted/50',
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  CUSTOMER:    'bg-muted text-muted-foreground',
  AI_AGENT:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  HUMAN_AGENT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  SYSTEM:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

/* ── Page component ───────────────────────────────────────── */
export default function ConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);
  const t = useTranslations('admin.conversations');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const addToast = useToastStore((s) => s.addToast);

  const { data: conversation, isLoading, error } = useAdminConversationDetail(conversationId);
  const updateConversation = useUpdateAdminConversation();

  /* ── Helpers ──────────────────────────────────────────── */
  function statusLabel(s: string) {
    const map: Record<string, string> = {
      ACTIVE: t('statusActive'),
      HANDED_OFF: t('statusHandedOff'),
      WAITING: t('statusWaiting'),
      RESOLVED: t('statusResolved'),
      ARCHIVED: t('statusArchived'),
    };
    return map[s] ?? s;
  }

  function roleLabel(r: string) {
    const map: Record<string, string> = {
      CUSTOMER: t('roleCustomer'),
      AI_AGENT: t('roleAiAgent'),
      HUMAN_AGENT: t('roleHumanAgent'),
      SYSTEM: t('roleSystem'),
    };
    return map[r] ?? r;
  }

  function handleStatusChange(newStatus: string) {
    updateConversation.mutate(
      { conversationId, status: newStatus },
      {
        onSuccess: () => {
          addToast('success', t('statusUpdated'));
        },
      },
    );
  }

  /* ── Error state ──────────────────────────────────────── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium mb-2">{tc('error')}</p>
        <Link
          href={`/${locale}/admin/conversations`}
          className="text-sm text-primary hover:underline"
        >
          {t('backToConversations')}
        </Link>
      </div>
    );
  }

  /* ── Loading state ────────────────────────────────────── */
  if (isLoading || !conversation) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const messages = conversation.messages ?? [];
  const tags = conversation.tags ?? conversation.conversationTags ?? [];
  const ratings = conversation.ratings ?? [];
  const notes = conversation.notes ?? [];

  return (
    <div>
      {/* ── Back button + Header ─────────────────────────── */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/${locale}/admin/conversations`}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('backToConversations')}
        </Link>
        <h1 className="text-2xl font-bold">{t('conversationDetail')}</h1>

        {/* Status change dropdown */}
        <div className="ms-auto flex items-center gap-2">
          <select
            value={conversation.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={updateConversation.isPending}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              STATUS_COLORS[conversation.status] ?? STATUS_COLORS.ACTIVE,
            )}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
          {updateConversation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column: info & sidebar ────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          {/* Customer info card */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              {t('customerInfo')}
            </h3>
            <div className="space-y-3">
              {(conversation.customerName || conversation.lead?.name || conversation.customer?.name) && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {conversation.customerName ?? conversation.lead?.name ?? conversation.customer?.name}
                  </span>
                </div>
              )}
              {(conversation.customerEmail || conversation.lead?.email || conversation.customer?.email) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{conversation.customerEmail ?? conversation.lead?.email ?? conversation.customer?.email}</span>
                </div>
              )}
              {(conversation.customerPhone || conversation.lead?.phone || conversation.customer?.phone) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{conversation.customerPhone ?? conversation.lead?.phone ?? conversation.customer?.phone}</span>
                </div>
              )}
              {conversation.org?.name && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{conversation.org?.name}</span>
                </div>
              )}
              {conversation.channel?.name && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Radio className="h-4 w-4" />
                  <span>{conversation.channel.name}</span>
                  {conversation.channel.type && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                      {t(`channel_${conversation.channel.type}`)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="mt-6 pt-6 border-t">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t('summary')}
              </label>
              <p className="text-sm text-muted-foreground">
                {conversation.summary ?? t('noSummary')}
              </p>
            </div>

            {/* Emotion */}
            {conversation.emotion && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {t('emotion')}
                </label>
                <span className="text-sm">{conversation.emotion}</span>
              </div>
            )}
          </div>

          {/* Tags card */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              <Tag className="h-4 w-4" />
              {t('tags')}
            </h3>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noTags')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((ct: any, idx: number) => {
                  const tag = ct.tag ?? ct;
                  return (
                    <span
                      key={tag.id ?? idx}
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={tag.color ? { backgroundColor: `${tag.color}20`, color: tag.color } : undefined}
                    >
                      {tag.name ?? tag.label ?? tag}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ratings card */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              <Star className="h-4 w-4" />
              {t('ratings')}
            </h3>
            {ratings.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noRatings')}</p>
            ) : (
              <div className="space-y-3">
                {ratings.map((rating: any, idx: number) => (
                  <div key={rating.id ?? idx}>
                    <div className="flex items-center gap-0.5 mb-1">
                      {Array.from({ length: 5 }).map((_, starIdx) => (
                        <Star
                          key={starIdx}
                          className={cn(
                            'h-4 w-4',
                            starIdx < (rating.score ?? rating.rating ?? 0)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-muted-foreground/50',
                          )}
                        />
                      ))}
                    </div>
                    {rating.feedback && (
                      <p className="text-xs text-muted-foreground">{rating.feedback}</p>
                    )}
                    {rating.createdAt && (
                      <span className="text-[10px] text-muted-foreground">
                        {fmtDateTime(rating.createdAt, locale)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes card */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              <StickyNote className="h-4 w-4" />
              {t('notes')}
            </h3>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noNotes')}</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note: any, idx: number) => (
                  <div key={note.id ?? idx} className="rounded-lg bg-muted/50 p-3">
                    <p className="text-sm">{note.content ?? note.body ?? note.text}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      {(note.user?.firstName || note.author?.firstName || note.createdBy?.firstName) && (
                        <span className="font-medium">
                          {note.user?.firstName ?? note.author?.firstName ?? note.createdBy?.firstName}
                          {' '}
                          {note.user?.lastName ?? note.author?.lastName ?? note.createdBy?.lastName ?? ''}
                        </span>
                      )}
                      {note.createdAt && (
                        <span>{fmtDateTime(note.createdAt, locale)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: message thread ───────────────── */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                <MessageSquare className="h-4 w-4" />
                {t('messageThread')}
                <span className="text-xs font-normal">({conversation.messageTotal ?? messages.length})</span>
              </h3>
            </div>

            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">{t('noMessages')}</p>
              </div>
            ) : (
              <div className="p-6 space-y-4 max-h-[700px] overflow-y-auto">
                {messages.map((msg: any, idx: number) => {
                  const role = msg.role ?? msg.senderRole ?? 'CUSTOMER';
                  const isSystem = role === 'SYSTEM';
                  const isCustomer = role === 'CUSTOMER';

                  return (
                    <div
                      key={msg.id ?? idx}
                      className={cn(
                        'flex flex-col gap-1',
                        isSystem ? 'items-center' : isCustomer ? 'items-start' : 'items-end',
                      )}
                    >
                      {/* Role badge */}
                      <div className="flex items-center gap-1.5">
                        {role === 'CUSTOMER' && <User className="h-3 w-3 text-muted-foreground" />}
                        {role === 'AI_AGENT' && <Bot className="h-3 w-3 text-blue-500" />}
                        {role === 'HUMAN_AGENT' && <Headphones className="h-3 w-3 text-purple-500" />}
                        {role === 'SYSTEM' && <Info className="h-3 w-3 text-amber-500" />}
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                            ROLE_BADGE_COLORS[role] ?? ROLE_BADGE_COLORS.CUSTOMER,
                          )}
                        >
                          {msg.senderName ?? roleLabel(role)}
                        </span>
                      </div>

                      {/* Message bubble */}
                      <div
                        className={cn(
                          'rounded-lg px-4 py-2.5 max-w-[80%] text-sm',
                          ROLE_BUBBLE[role] ?? ROLE_BUBBLE.CUSTOMER,
                          isSystem && 'italic text-center',
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {msg.content ?? msg.body ?? msg.text ?? ''}
                        </p>
                      </div>

                      {/* Timestamp */}
                      <span className="text-[10px] text-muted-foreground">
                        {fmtDateTime(msg.createdAt ?? msg.timestamp, locale)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
