'use client';

import { Link } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { fmtDateTime, fmtTime } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';
import { MessageCircle, User, Clock } from 'lucide-react';

/* ── Status badge colors ─────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  HANDED_OFF: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  WAITING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  RESOLVED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

interface ConversationCardProps {
  conversation: {
    id: string;
    customerName?: string | null;
    customerEmail?: string | null;
    status: string;
    lastMessageAt: string;
    lastEmotion?: string | null;
    leads?: Array<{ name?: string; email?: string }>;
    channel?: { name?: string; type?: string } | null;
    _count?: { messages?: number } | null;
  };
  statusLabel: (status: string) => string;
}

export function ConversationCard({ conversation, statusLabel }: ConversationCardProps) {
  const locale = useLocale();

  const customerName = conversation.customerName ?? conversation.leads?.[0]?.name ?? 'Unknown';
  const customerEmail = conversation.customerEmail ?? conversation.leads?.[0]?.email ?? '';
  const messageCount = conversation._count?.messages ?? 0;

  return (
    <Link
      href={`/admin/conversations/${conversation.id}`}
      className="block rounded-xl border bg-card p-4 transition-colors active:bg-muted/50 hover:bg-muted/30"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-6 w-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header: Name + Time */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-semibold truncate">{customerName}</p>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {fmtTime(conversation.lastMessageAt, locale)}
            </span>
          </div>

          {/* Email */}
          {customerEmail && (
            <p className="text-sm text-muted-foreground truncate mb-2">
              {customerEmail}
            </p>
          )}

          {/* Channel + Message count */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
            {conversation.channel?.name && (
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" />
                {conversation.channel.name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {messageCount} messages
            </span>
          </div>

          {/* Footer: Status badge */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                STATUS_COLORS[conversation.status] ?? STATUS_COLORS.ACTIVE,
              )}
            >
              {statusLabel(conversation.status)}
            </span>
            {conversation.lastEmotion && (
              <span className="text-xs text-muted-foreground">
                {conversation.lastEmotion}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
