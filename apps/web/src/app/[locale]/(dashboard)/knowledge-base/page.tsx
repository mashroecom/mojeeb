'use client';

import { useState } from 'react';
import { useKnowledgeBases } from '@/hooks/useKnowledgeBase';
import { KBListView } from './_components/KBListView';
import { KBDetailView } from './_components/KBDetailView';

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function KnowledgeBasePage() {
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: knowledgeBases, isLoading } = useKnowledgeBases();

  if (selectedKbId) {
    return <KBDetailView kbId={selectedKbId} onBack={() => setSelectedKbId(null)} />;
  }

  return (
    <KBListView
      knowledgeBases={knowledgeBases}
      isLoading={isLoading}
      onSelect={(id) => setSelectedKbId(id)}
      onShowCreate={() => setShowCreateForm(true)}
      showCreateForm={showCreateForm}
      onHideCreate={() => setShowCreateForm(false)}
    />
  );
}
