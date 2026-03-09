'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAgent,
  useLinkKnowledgeBase,
  useUnlinkKnowledgeBase,
} from '@/hooks/useAgents';
import { useKnowledgeBases } from '@/hooks/useKnowledgeBase';
import { toast } from '@/hooks/useToast';
import { Link } from '@/i18n/navigation';
import { BookOpen, Plus, X, Loader2 } from 'lucide-react';

export function KnowledgeBaseSection({ agentId }: { agentId: string }) {
  const t = useTranslations('dashboard.agents');
  const tc = useTranslations('common');
  const { data: agent } = useAgent(agentId);
  const { data: allKbs } = useKnowledgeBases();
  const linkKb = useLinkKnowledgeBase();
  const unlinkKb = useUnlinkKnowledgeBase();
  const [showSelector, setShowSelector] = useState(false);

  const linkedKbIds = new Set(
    agent?.knowledgeBases?.map((akb) => akb.knowledgeBaseId) ?? [],
  );

  const availableKbs = (allKbs ?? []).filter((kb) => !linkedKbIds.has(kb.id));

  const handleLink = (knowledgeBaseId: string) => {
    linkKb.mutate({ agentId, knowledgeBaseId }, {
      onSuccess: () => {
        toast.success(tc('toast.kbLinked'));
        setShowSelector(false);
      },
      onError: () => {
        toast.error(tc('toast.kbLinkFailed'));
      },
    });
  };

  const handleUnlink = (knowledgeBaseId: string) => {
    unlinkKb.mutate({ agentId, knowledgeBaseId }, {
      onSuccess: () => toast.success(tc('toast.kbUnlinked')),
      onError: () => toast.error(tc('toast.kbUnlinkFailed')),
    });
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BookOpen className="h-5 w-5" />
              {t('knowledgeBases')}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t('knowledgeBasesHint')}
            </p>
          </div>
          {availableKbs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSelector(!showSelector)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-3 w-3" />
              {t('addKnowledgeBase')}
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Selector dropdown */}
        {showSelector && (
          <div className="mb-4 rounded-lg border bg-muted/30 p-3">
            <div className="space-y-1">
              {availableKbs.map((kb) => (
                <button
                  key={kb.id}
                  type="button"
                  onClick={() => handleLink(kb.id)}
                  disabled={linkKb.isPending}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors text-start"
                >
                  <BookOpen className="h-4 w-4 text-primary shrink-0" />
                  <span>{kb.name}</span>
                  {linkKb.isPending && (
                    <Loader2 className="h-3 w-3 animate-spin ms-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Linked KBs */}
        {agent?.knowledgeBases && agent.knowledgeBases.length > 0 ? (
          <div className="space-y-2">
            {agent.knowledgeBases.map((akb) => (
              <div
                key={akb.knowledgeBaseId}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-1.5">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">
                    {akb.knowledgeBase.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnlink(akb.knowledgeBaseId)}
                  disabled={unlinkKb.isPending}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {unlinkKb.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                  {t('removeKnowledgeBase')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              {allKbs && allKbs.length === 0
                ? t('noKnowledgeBasesAvailable')
                : t('noKnowledgeBases')}
            </p>
            {allKbs && allKbs.length === 0 && (
              <Link
                href="/knowledge-base"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                {t('createKnowledgeBase')}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
