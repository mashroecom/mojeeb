'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAgents, useDeleteAgent, type Agent } from '@/hooks/useAgents';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getTemplateById } from '@/lib/agent-templates';
import { cn } from '@/lib/utils';
import {
  Bot,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  MessageSquare,
  Headphones,
  Briefcase,
  HelpCircle,
  Calendar,
  ShoppingCart,
  BookOpen,
  Globe,
  MessageCircle,
  ClipboardList,
  GraduationCap,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Headphones,
  Briefcase,
  HelpCircle,
  Calendar,
  ShoppingCart,
  Bot,
  Globe,
  MessageCircle,
  ClipboardList,
  GraduationCap,
};

function getAgentIcon(templateType: string | null | undefined) {
  if (!templateType) return Bot;
  const template = getTemplateById(templateType);
  if (!template) return Bot;
  return ICON_MAP[template.iconName] || Bot;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function AgentCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-3 w-48 rounded bg-muted" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-24 rounded bg-muted" />
        <div className="h-6 w-12 rounded bg-muted" />
        <div className="h-6 w-20 rounded bg-muted" />
      </div>
      <div className="mt-4 flex gap-2 border-t pt-4">
        <div className="h-8 w-16 rounded bg-muted" />
        <div className="h-8 w-16 rounded bg-muted" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent card
// ---------------------------------------------------------------------------

function AgentCard({ agent }: { agent: Agent }) {
  const t = useTranslations('dashboard.agents');
  const tt = useTranslations('dashboard.agents.templates');
  const deleteAgent = useDeleteAgent();
  const { confirmProps, confirm } = useConfirmDialog();

  const handleDelete = () => {
    confirm({
      title: t('delete'),
      message: t('deleteConfirm'),
      confirmLabel: t('delete'),
      cancelLabel: t('cancel'),
      variant: 'danger',
      onConfirm: () => {
        deleteAgent.mutate(agent.id);
      },
    });
  };

  const Icon = getAgentIcon(agent.templateType);
  const template = agent.templateType ? getTemplateById(agent.templateType) : null;

  return (
    <>
      <div className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                agent.isActive
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{agent.name}</h3>
              {agent.description && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {agent.description}
                </p>
              )}
            </div>
          </div>

          {/* Status badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shrink-0',
              agent.isActive
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
            )}
          >
            <ToggleLeft className="h-3 w-3" />
            {agent.isActive ? t('isActive') : t('inactive')}
          </span>
        </div>

        {/* Badges */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* Template type badge */}
          {template && (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              <Icon className="h-3 w-3" />
              {tt(template.nameKey)}
            </span>
          )}

          {/* Language badge */}
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
            {agent.language === 'ar' ? t('languageAr') : t('languageEn')}
          </span>

          {/* KB count */}
          {agent.knowledgeBases && agent.knowledgeBases.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              <BookOpen className="h-3 w-3" />
              {agent.knowledgeBases.length} {t('knowledgeBases')}
            </span>
          )}

          {/* Channel count */}
          {agent.channels && agent.channels.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              {agent.channels.length} {t('channels')}
            </span>
          )}

          {/* Conversation count */}
          {agent._count && agent._count.conversations > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {agent._count.conversations} {t('conversations')}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2 border-t pt-4">
          <Link
            href={`/agents/${agent.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Pencil className="h-3 w-3" />
            {t('editAgent')}
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteAgent.isPending}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950',
              deleteAgent.isPending && 'cursor-not-allowed opacity-50',
            )}
          >
            <Trash2 className="h-3 w-3" />
            {deleteAgent.isPending ? '...' : t('delete')}
          </button>
        </div>
      </div>
      <ConfirmDialog {...confirmProps} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AgentsPage() {
  const t = useTranslations('dashboard.agents');
  const tc = useTranslations('common');
  const { data: agents, isLoading, isError, refetch } = useAgents();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link
          href="/agents/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t('createAgent')}
        </Link>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {!isLoading && isError && (
        <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Bot className="h-6 w-6 text-destructive" />
          </div>
          <p className="font-medium">{tc('somethingWentWrong')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tc('errorDescription')}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {tc('tryAgain')}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && (!agents || agents.length === 0) && (
        <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Bot className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">{t('noAgents')}</p>
          <Link
            href="/agents/new"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('createAgent')}
          </Link>
        </div>
      )}

      {/* Agent grid */}
      {!isLoading && !isError && agents && agents.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
