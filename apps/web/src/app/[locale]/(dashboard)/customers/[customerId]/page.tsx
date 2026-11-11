'use client';

import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Mail,
  MessageSquare,
  Phone,
  Radio,
  Star,
  StickyNote,
  Tag as TagIcon,
  UserX,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { fmtDate, fmtDateTime } from '@/lib/dateFormat';
import {
  isNotFoundError,
  useCustomer,
  type CustomerConversation,
  type CustomerNote,
  type CustomerProfile,
  type CustomerTag,
} from '@/hooks/useCustomers';
import { ChannelBadge, EmotionBadge } from '../_components/CustomerBadges';
import { STATUS_BADGE_VARIANT, STATUS_LABEL_KEY, initialOf } from '../_lib/display';

export default function CustomerProfilePage() {
  const t = useTranslations('dashboard.customers');
  const ts = useTranslations('dashboard.sidebar');
  const tb = useTranslations('dashboard.breadcrumb');
  const router = useRouter();
  const params = useParams();
  const rawId = params.customerId;
  const customerId = decodeURIComponent(Array.isArray(rawId) ? rawId[0] : (rawId ?? ''));

  const { data: customer, isLoading, isError, error, refetch } = useCustomer(customerId);

  const displayName = customer ? customer.name || t('unknownCustomer') : undefined;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: tb('dashboard'), href: '/dashboard' },
          { label: ts('customers'), href: '/customers' },
          ...(displayName ? [{ label: displayName }] : []),
        ]}
        className="mb-4"
      />

      <Link
        href="/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t('backToCustomers')}
      </Link>

      {isLoading ? (
        <ProfileSkeleton />
      ) : isError && isNotFoundError(error) ? (
        <div className="rounded-xl border bg-card shadow-sm">
          <EmptyState
            icon={UserX}
            title={t('notFound')}
            description={t('notFoundDescription')}
            action={{ label: t('backToCustomers'), onClick: () => router.push('/customers') }}
          />
        </div>
      ) : isError || !customer ? (
        <div className="rounded-xl border bg-card shadow-sm">
          <ErrorState
            title={t('errorTitle')}
            description={t('profileErrorDescription')}
            retryLabel={t('retry')}
            onRetry={() => refetch()}
          />
        </div>
      ) : (
        <ProfileContent customer={customer} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonCard />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rect" />
        ))}
      </div>
      <SkeletonCard />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function ProfileContent({ customer }: { customer: CustomerProfile }) {
  const t = useTranslations('dashboard.customers');
  const locale = useLocale();
  const name = customer.name || t('unknownCustomer');

  return (
    <div className="space-y-6">
      {/* Identity card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
            {initialOf(customer.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold break-words">
                <bdi>{name}</bdi>
              </h1>
              {customer.lastEmotion && <EmotionBadge emotion={customer.lastEmotion} />}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              {customer.email && (
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <Mail className="h-4 w-4 shrink-0" />
                  <bdi className="truncate">{customer.email}</bdi>
                </span>
              )}
              {customer.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-4 w-4 shrink-0" />
                  <bdi dir="ltr">{customer.phone}</bdi>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {t('lastActive')}: {fmtDateTime(customer.lastActiveAt, locale)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Aggregates */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label={t('firstSeen')}>
          <span data-testid="stat-first-seen">{fmtDate(customer.firstSeenAt, locale)}</span>
        </StatCard>
        <StatCard icon={MessageSquare} label={t('totalConversations')}>
          <span data-testid="stat-total-conversations">{customer.totalConversations}</span>
        </StatCard>
        <StatCard icon={Star} label={t('avgRating')}>
          {customer.avgRating !== null ? (
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span data-testid="stat-avg-rating" dir="ltr">
                {customer.avgRating.toFixed(1)}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {t('ratingsCount', { count: customer.ratingsCount })}
              </span>
            </span>
          ) : (
            <span className="text-sm font-normal text-muted-foreground">{t('noRatings')}</span>
          )}
        </StatCard>
        <StatCard icon={Radio} label={t('channelsUsed')}>
          <span className="flex flex-wrap gap-1">
            {customer.channels.map((ch) => (
              <ChannelBadge key={ch} channel={ch} />
            ))}
          </span>
        </StatCard>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border bg-card p-4 shadow-sm md:p-6">
        <Tabs
          tabs={[
            {
              key: 'conversations',
              label: `${t('tabConversations')} (${customer.totalConversations})`,
              content: (
                <ConversationsTab
                  conversations={customer.conversations}
                  total={customer.totalConversations}
                />
              ),
            },
            {
              key: 'tags',
              label: `${t('tabTags')} (${customer.tags.length})`,
              content: <TagsTab tags={customer.tags} />,
            },
            {
              key: 'notes',
              label: `${t('tabNotes')} (${customer.notes.length})`,
              content: <NotesTab notes={customer.notes} />,
            },
          ]}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function TabEmpty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function conversationHref(conversationId: string) {
  return `/conversations?id=${encodeURIComponent(conversationId)}`;
}

function ConversationsTab({
  conversations,
  total,
}: {
  conversations: CustomerConversation[];
  total: number;
}) {
  const t = useTranslations('dashboard.customers');
  const locale = useLocale();

  if (conversations.length === 0)
    return <TabEmpty icon={MessageSquare} text={t('noConversations')} />;

  return (
    <div>
      <ul className="divide-y">
        {conversations.map((conv) => (
          <li key={conv.id}>
            <Link
              href={conversationHref(conv.id)}
              aria-label={t('viewConversation')}
              data-testid="customer-conversation-link"
              className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_BADGE_VARIANT[conv.status] ?? 'neutral'}>
                    {STATUS_LABEL_KEY[conv.status] ? t(STATUS_LABEL_KEY[conv.status]) : conv.status}
                  </Badge>
                  <ChannelBadge channel={conv.channel.type} />
                  <span className="text-xs text-muted-foreground">
                    <bdi>{conv.channel.name}</bdi>
                  </span>
                  {conv.lastEmotion && <EmotionBadge emotion={conv.lastEmotion} />}
                  {conv.rating !== null && (
                    <span
                      className="inline-flex items-center gap-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400"
                      aria-label={t('ratingOutOf', { rating: conv.rating })}
                    >
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {conv.rating}
                    </span>
                  )}
                </div>
                {conv.summary && (
                  <p className="mt-1.5 text-sm text-foreground line-clamp-2">
                    <bdi>{conv.summary}</bdi>
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {fmtDateTime(conv.lastMessageAt, locale)}
                  {' · '}
                  {t('messageCount', { count: conv.messageCount })}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
            </Link>
          </li>
        ))}
      </ul>
      {total > conversations.length && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t('recentConversationsNote', { count: conversations.length })}
        </p>
      )}
    </div>
  );
}

function TagsTab({ tags }: { tags: CustomerTag[] }) {
  const t = useTranslations('dashboard.customers');

  if (tags.length === 0) return <TabEmpty icon={TagIcon} text={t('noTags')} />;

  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li
          key={tag.id}
          className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: tag.color }}
            aria-hidden="true"
          />
          <bdi className="font-medium">{tag.name}</bdi>
          <span className="text-xs text-muted-foreground">
            {t('tagConversations', { count: tag.conversationCount })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function NotesTab({ notes }: { notes: CustomerNote[] }) {
  const t = useTranslations('dashboard.customers');
  const locale = useLocale();

  if (notes.length === 0) return <TabEmpty icon={StickyNote} text={t('noNotes')} />;

  return (
    <ul className="space-y-3">
      {notes.map((note) => {
        const edited =
          new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 1000;
        return (
          <li key={note.id} className="rounded-lg border bg-background p-4">
            <p className="text-sm whitespace-pre-wrap break-words" dir="auto">
              {note.content}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {note.author && <bdi className="font-medium">{note.author.name}</bdi>}
              <span>{fmtDateTime(note.createdAt, locale)}</span>
              {edited && (
                <span>({t('edited', { date: fmtDateTime(note.updatedAt, locale) })})</span>
              )}
              <Link
                href={conversationHref(note.conversationId)}
                className="ms-auto text-primary hover:underline"
              >
                {t('viewConversation')}
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
