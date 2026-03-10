'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Plus } from 'lucide-react';
import { useKnowledgeBases } from '@/hooks/useKnowledgeBase';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { KBListView } from './_components/KBListView';
import { KBDetailView } from './_components/KBDetailView';

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function KnowledgeBasePage() {
  const t = useTranslations('dashboard.knowledgeBase');
  const tc = useTranslations('common');
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: knowledgeBases, isLoading, isError, refetch } = useKnowledgeBases();

  // Show detail view when a KB is selected
  if (selectedKbId) {
    return <KBDetailView kbId={selectedKbId} onBack={() => setSelectedKbId(null)} />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        {!showCreateForm && !isLoading && !isError && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('createKb')}
          </button>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {!isLoading && isError && (
        <ErrorState
          title={tc('somethingWentWrong')}
          description={tc('errorDescription')}
          retryLabel={tc('tryAgain')}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty state */}
      {!isLoading && !isError && (!knowledgeBases || knowledgeBases.length === 0) && (
        <EmptyState
          icon={BookOpen}
          title={t('noKb')}
          action={{
            label: t('createKb'),
            onClick: () => setShowCreateForm(true),
          }}
        />
      )}

      {/* Content state - KB List */}
      {!isLoading && !isError && knowledgeBases && knowledgeBases.length > 0 && (
        <KBListView
          knowledgeBases={knowledgeBases}
          onSelect={(id) => setSelectedKbId(id)}
          showCreateForm={showCreateForm}
          onHideCreate={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}
