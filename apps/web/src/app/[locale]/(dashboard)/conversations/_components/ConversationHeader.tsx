'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowRightLeft,
  CheckCircle2,
  Bot,
  User,
  Trash2,
  Brain,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/hooks/useConversations';
import { STATUS_BADGE, CHANNEL_TRANSLATION_KEY } from '../_lib/constants';

interface ConversationHeaderProps {
  conversation: Conversation | undefined;
  onBack: () => void;
  onHandoff: () => void;
  onResolve: () => void;
  onReturnToAI: () => void;
  onDelete: () => void;
  onToggleInsights: () => void;
  onMobileInsightsOpen: () => void;
  insightsOpen: boolean;
  isHandoffPending: boolean;
  isResolvePending: boolean;
  isReturnToAIPending: boolean;
  isDeletePending: boolean;
}

export function ConversationHeader({
  conversation,
  onBack,
  onHandoff,
  onResolve,
  onReturnToAI,
  onDelete,
  onToggleInsights,
  onMobileInsightsOpen,
  insightsOpen,
  isHandoffPending,
  isResolvePending,
  isReturnToAIPending,
  isDeletePending,
}: ConversationHeaderProps) {
  const t = useTranslations('dashboard.conversations');

  // Mobile actions dropdown
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const isHandedOff = conversation?.status === 'HANDED_OFF';

  return (
    <div className="flex items-center justify-between border-b bg-card px-3 md:px-5 py-3">
      <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
        {/* Mobile back button */}
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent md:hidden"
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        {/* Avatar */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-4 w-4" />
        </div>
        <div className="overflow-hidden">
          <p className="truncate text-sm font-semibold">
            {conversation?.customerName || t('guestUser')}
          </p>
          <div className="flex items-center gap-2">
            {conversation?.status && (
              <span
                className={cn(
                  'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
                  STATUS_BADGE[conversation.status],
                )}
              >
                {t(`status${conversation.status}`)}
              </span>
            )}
            {conversation?.channel && (
              <span className="text-xs text-muted-foreground">
                {CHANNEL_TRANSLATION_KEY[conversation.channel.type?.toLowerCase()]
                  ? t(CHANNEL_TRANSLATION_KEY[conversation.channel.type.toLowerCase()])
                  : conversation.channel.type}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        {/* ── Desktop: inline buttons ── */}
        <div className="hidden md:flex items-center gap-2">
          {isHandedOff ? (
            <button
              onClick={onReturnToAI}
              disabled={isReturnToAIPending}
              title={t('returnToAI')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
            >
              <Bot className="h-3.5 w-3.5" />
              <span>{t('returnToAI')}</span>
            </button>
          ) : (
            <button
              onClick={onHandoff}
              disabled={isHandoffPending}
              title={t('handoff')}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>{t('handoff')}</span>
            </button>
          )}
          <button
            onClick={onResolve}
            disabled={isResolvePending}
            title={t('resolve')}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{t('resolve')}</span>
          </button>
          <button
            onClick={onDelete}
            disabled={isDeletePending}
            title={t('delete')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t('delete')}</span>
          </button>
          {/* Desktop insights toggle */}
          <button
            onClick={onToggleInsights}
            className="inline-flex items-center justify-center rounded-lg border p-1.5 transition-colors hover:bg-muted"
            title={t('toggleInsights')}
          >
            {insightsOpen ? (
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            ) : (
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            )}
          </button>
        </div>

        {/* ── Mobile: insights + actions dropdown ── */}
        <div className="flex md:hidden items-center gap-1">
          {/* Mobile insights toggle */}
          <button
            onClick={onMobileInsightsOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
            title={t('toggleInsights')}
          >
            <Brain className="h-4 w-4" />
          </button>

          {/* Mobile actions menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
              aria-label={t('actions')}
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute end-0 top-full mt-1 z-50 w-56 rounded-xl border bg-popover p-1.5 shadow-lg">
                {isHandedOff ? (
                  <button
                    onClick={() => { onReturnToAI(); setMenuOpen(false); }}
                    disabled={isReturnToAIPending}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                  >
                    <Bot className="h-4 w-4 shrink-0" />
                    {t('returnToAI')}
                  </button>
                ) : (
                  <button
                    onClick={() => { onHandoff(); setMenuOpen(false); }}
                    disabled={isHandoffPending}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <ArrowRightLeft className="h-4 w-4 shrink-0" />
                    {t('handoff')}
                  </button>
                )}
                <button
                  onClick={() => { onResolve(); setMenuOpen(false); }}
                  disabled={isResolvePending}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {t('resolve')}
                </button>
                <div className="my-1 border-t" />
                <button
                  onClick={() => { onDelete(); setMenuOpen(false); }}
                  disabled={isDeletePending}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  {t('delete')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
