'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Brain, X, StickyNote, Plus, Pencil, Trash2, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/hooks/useConversations';
import {
  useConversationNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  type ConversationNote,
} from '@/hooks/useConversations';
import {
  relativeTime,
  getEmotionEmoji,
  emotionBadgeClass,
  EMOTION_TRANSLATION_KEY,
} from '../_lib/constants';

interface InsightsPanelProps {
  conversation: Conversation | undefined;
  currentEmotion: string | null;
  emotionScore: number | null;
  currentSummary: string | null;
}

// ---------------------------------------------------------------------------
// Notes Section
// ---------------------------------------------------------------------------

function NotesSection({ conversationId }: { conversationId: string | null }) {
  const t = useTranslations('dashboard.conversations');
  const { data: notes, isLoading } = useConversationNotes(conversationId);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  function handleAdd() {
    if (!newNote.trim() || !conversationId) return;
    createNote.mutate(
      { conversationId, content: newNote.trim() },
      { onSuccess: () => setNewNote('') },
    );
  }

  function startEdit(note: ConversationNote) {
    setEditingId(note.id);
    setEditValue(note.content);
  }

  function handleUpdate() {
    if (!editValue.trim() || !conversationId || !editingId) return;
    updateNote.mutate(
      { conversationId, noteId: editingId, content: editValue.trim() },
      { onSuccess: () => setEditingId(null) },
    );
  }

  function handleDelete(noteId: string) {
    if (!conversationId) return;
    deleteNote.mutate({ conversationId, noteId });
  }

  if (!conversationId) return null;

  return (
    <div className="mt-5 border-t pt-5">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <StickyNote className="h-3 w-3" />
        {t('notes')}
      </h4>

      {/* Add note */}
      <div className="mb-3 flex gap-1.5">
        <input
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={t('addNotePlaceholder')}
          className="flex-1 rounded-md border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/40"
        />
        <button
          onClick={handleAdd}
          disabled={!newNote.trim() || createNote.isPending}
          className="inline-flex items-center justify-center rounded-md bg-primary px-2 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {createNote.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Notes list */}
      {isLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : notes && notes.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {notes.map((note) => (
            <div
              key={note.id}
              className="group rounded-md border bg-muted/30 px-2.5 py-2 text-xs"
            >
              {editingId === note.id ? (
                <div className="flex gap-1.5">
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                    className="flex-1 rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/40"
                    autoFocus
                  />
                  <button
                    onClick={handleUpdate}
                    disabled={updateNote.isPending}
                    className="text-primary hover:text-primary/80"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="leading-relaxed whitespace-pre-wrap">{note.content}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(note.createdAt).toLocaleString()}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={() => startEdit(note)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">{t('noNotes')}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insights Content
// ---------------------------------------------------------------------------

function InsightsContent({
  conversation,
  currentEmotion,
  emotionScore,
  currentSummary,
}: InsightsPanelProps) {
  const t = useTranslations('dashboard.conversations');

  return (
    <>
      {/* Emotion */}
      <div className="mb-5">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('emotion')}
        </h4>
        {currentEmotion ? (
          <div className="flex items-center gap-2">
            <span className="text-lg">{getEmotionEmoji(currentEmotion)}</span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize',
                emotionBadgeClass(currentEmotion),
              )}
            >
              {EMOTION_TRANSLATION_KEY[currentEmotion.toLowerCase()]
                ? t(EMOTION_TRANSLATION_KEY[currentEmotion.toLowerCase()])
                : currentEmotion}
            </span>
            {emotionScore != null && (
              <span className="text-xs text-muted-foreground">
                {Math.round(emotionScore * 100)}%
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {t('noEmotion')}
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="mb-5">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('summary')}
        </h4>
        {currentSummary ? (
          <p className="text-sm leading-relaxed text-foreground/80">
            {currentSummary}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {t('noSummary')}
          </p>
        )}
      </div>

      {/* Last updated */}
      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('lastUpdated')}
        </h4>
        <p className="text-xs text-muted-foreground">
          {relativeTime(
            conversation?.lastMessageAt ?? conversation?.createdAt ?? null,
            t,
          )}
        </p>
      </div>

      {/* Notes */}
      <NotesSection conversationId={conversation?.id ?? null} />
    </>
  );
}

// Desktop sidebar panel
export function InsightsSidebar(props: InsightsPanelProps) {
  const t = useTranslations('dashboard.conversations');

  return (
    <aside className="hidden md:flex w-72 shrink-0 flex-col border-s bg-card">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t('aiInsights')}</h3>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <InsightsContent {...props} />
      </div>
    </aside>
  );
}

// Mobile bottom drawer
interface MobileInsightsDrawerProps extends InsightsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function MobileInsightsDrawer({
  open,
  onClose,
  ...props
}: MobileInsightsDrawerProps) {
  const t = useTranslations('dashboard.conversations');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer from bottom */}
      <div className="absolute bottom-0 start-0 end-0 max-h-[70vh] rounded-t-2xl border-t bg-card shadow-lg overflow-y-auto animate-in slide-in-from-bottom duration-300">
        {/* Handle bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-3 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">{t('aiInsights')}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <InsightsContent {...props} />
        </div>
      </div>
    </div>
  );
}
