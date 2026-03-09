'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Loader2, MessagesSquare, Download, CheckCircle, Archive, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/useToast';
import { exportToCsv } from '@/lib/exportCsv';
import { fmtDateTime } from '@/lib/dateFormat';
import {
  useConversations,
  useConversation,
  useMessages,
  useSendMessage,
  useUploadFile,
  useHandoff,
  useResolve,
  useReturnToAI,
  useDeleteConversation,
  useBulkArchive,
  useBulkResolve,
  useBulkDelete,
  type Conversation,
  type Message,
} from '@/hooks/useConversations';
import { useSocket } from '@/hooks/useSocket';
import { useChatStore } from '@/stores/chatStore';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { STATUS_FILTER_MAP, type StatusFilter } from './_lib/constants';
import { ConversationList } from './_components/ConversationList';
import { ConversationHeader } from './_components/ConversationHeader';
import { MessageBubble } from './_components/MessageBubble';
import { MessageInput } from './_components/MessageInput';
import { InsightsSidebar, MobileInsightsDrawer } from './_components/InsightsPanel';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ConversationsPage() {
  const t = useTranslations('dashboard.conversations');
  const tc = useTranslations('common');
  const locale = useLocale();

  // ---- URL query param for deep-linking ----
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id');

  // ---- Local state ----
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialId);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [channelId, setChannelId] = useState<string>('');
  const [sentiment, setSentiment] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [messageInput, setMessageInput] = useState('');
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [mobileInsightsOpen, setMobileInsightsOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ---- Socket ----
  const { joinConversation, leaveConversation, emitTyping } = useSocket();

  // ---- Real-time store ----
  const messagesByConversation = useChatStore((s) => s.messagesByConversation);
  const typingByConversation = useChatStore((s) => s.typingByConversation);
  const conversationUpdates = useChatStore((s) => s.conversationUpdates);

  // ---- Debounce search query (300ms) ----
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ---- Clear selection when search or status filter changes ----
  useEffect(() => {
    setSelectedIds(new Set());
  }, [debouncedSearch, statusFilter]);

  // ---- React Query ----
  const conversationsQuery = useConversations({
    status: STATUS_FILTER_MAP[statusFilter],
    limit: 50,
    search: debouncedSearch || undefined,
    channelId: channelId || undefined,
    sentiment: sentiment || undefined,
    category: category || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });
  const conversations: Conversation[] = conversationsQuery.data?.data ?? [];

  const conversationDetail = useConversation(selectedConversationId ?? '');
  const selectedConversation: Conversation | undefined = conversationDetail.data?.data;

  const messagesQuery = useMessages(selectedConversationId ?? '');
  const queryMessages: Message[] = useMemo(() => {
    if (!messagesQuery.data) return [];
    return messagesQuery.data.pages.flatMap((page) => page.data);
  }, [messagesQuery.data]);

  // ---- Merge query messages + real-time messages ----
  const allMessages = useMemo(() => {
    if (!selectedConversationId) return [];
    const realtimeMessages = messagesByConversation[selectedConversationId] ?? [];
    const queryIds = new Set(queryMessages.map((m) => m.id));
    const newRealtime = realtimeMessages.filter((m) => !queryIds.has(m.id));
    const merged = [
      ...queryMessages,
      ...newRealtime.map((m) => ({
        id: m.id,
        role: m.role as Message['role'],
        content: m.content,
        contentType: m.contentType as Message['contentType'],
        metadata: null,
        createdAt: m.createdAt,
      })),
    ];
    merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return merged;
  }, [queryMessages, messagesByConversation, selectedConversationId]);

  const isTyping = selectedConversationId
    ? typingByConversation[selectedConversationId] ?? false
    : false;

  const realtimeUpdate = selectedConversationId
    ? conversationUpdates[selectedConversationId]
    : undefined;
  const currentEmotion = realtimeUpdate?.emotion ?? selectedConversation?.lastEmotion ?? null;
  const currentSummary = realtimeUpdate?.summary ?? selectedConversation?.summary ?? null;
  const emotionScore = realtimeUpdate?.emotionScore ?? selectedConversation?.emotionScore ?? null;

  // ---- Mutations ----
  const sendMessage = useSendMessage();
  const uploadFile = useUploadFile();
  const handoff = useHandoff();
  const resolve = useResolve();
  const returnToAI = useReturnToAI();
  const deleteConversation = useDeleteConversation();
  const bulkArchive = useBulkArchive();
  const bulkResolve = useBulkResolve();
  const bulkDelete = useBulkDelete();
  const { confirmProps, confirm } = useConfirmDialog();

  // ---- Auto-scroll messages ----
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length, isTyping]);

  // ---- Join / leave conversation on selection change ----
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevSelectedRef.current;
    if (prev && prev !== selectedConversationId) leaveConversation(prev);
    if (selectedConversationId && selectedConversationId !== prev)
      joinConversation(selectedConversationId);
    prevSelectedRef.current = selectedConversationId;
  }, [selectedConversationId, joinConversation, leaveConversation]);

  // ---- Handlers ----
  const handleSelectConversation = useCallback((id: string) => {
    setSelectedConversationId((prev) => (prev === id ? prev : id));
    setMessageInput('');
  }, []);

  // ---- Multi-select handlers ----
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === conversations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(conversations.map((c) => c.id)));
    }
  }, [selectedIds.size, conversations]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allSelected = conversations.length > 0 && selectedIds.size === conversations.length;
  const someSelected = selectedIds.size > 0;

  const handleSend = useCallback(() => {
    if (!messageInput.trim() || !selectedConversationId) return;
    sendMessage.mutate({ conversationId: selectedConversationId, content: messageInput.trim() });
    setMessageInput('');
    emitTyping(selectedConversationId, false);
  }, [messageInput, selectedConversationId, sendMessage, emitTyping]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleDelete = useCallback(() => {
    if (!selectedConversationId) return;
    confirm({
      title: t('delete'),
      message: t('deleteConfirm'),
      confirmLabel: t('delete'),
      cancelLabel: t('cancel'),
      variant: 'danger',
      onConfirm: () => {
        deleteConversation.mutate(
          { conversationId: selectedConversationId },
          {
            onSuccess: () => {
              setSelectedConversationId(null);
              toast.success(tc('toast.convDeleted'));
            },
            onError: () => toast.error(tc('toast.convDeleteFailed')),
          },
        );
      },
    });
  }, [selectedConversationId, deleteConversation, t, confirm]);

  const handleCopyMessage = useCallback(
    async (messageId: string, content: string, contentType?: string, mediaUrl?: string) => {
      try {
        if (contentType === 'IMAGE' && mediaUrl) {
          const res = await fetch(mediaUrl);
          const originalBlob = await res.blob();
          const pngBlob = await new Promise<Blob>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              canvas.getContext('2d')!.drawImage(img, 0, 0);
              canvas.toBlob((blob) => {
                if (blob) { resolve(blob); } else { reject(new Error('Failed to convert')); }
              }, 'image/png');
              URL.revokeObjectURL(img.src);
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(originalBlob);
          });
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
        } else {
          await navigator.clipboard.writeText(content);
        }
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 1500);
      } catch {
        if (mediaUrl) {
          await navigator.clipboard.writeText(mediaUrl).catch(() => {});
          setCopiedMessageId(messageId);
          setTimeout(() => setCopiedMessageId(null), 1500);
        }
      }
    },
    [],
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedConversationId) return;
      uploadFile.mutate({ conversationId: selectedConversationId, file });
      e.target.value = '';
    },
    [selectedConversationId, uploadFile],
  );

  function handleExport() {
    if (!conversations.length) return;
    const rows = conversations.map((conv) => ({
      customerName: conv.customerName ?? '',
      channel: conv.channel?.name ?? '',
      status: conv.status,
      messageCount: conv.messages?.length ?? 0,
      emotion: conv.lastEmotion ?? '',
      lastMessageAt: fmtDateTime(conv.lastMessageAt, locale),
    }));
    exportToCsv('conversations', rows);
  }

  // ---- Bulk action handlers ----
  const handleBulkResolve = useCallback(() => {
    const ids = Array.from(selectedIds);
    confirm({
      title: t('bulkResolve', { count: ids.length }),
      message: t('confirmBulkResolve', { count: ids.length }),
      confirmLabel: t('bulkResolve', { count: ids.length }),
      cancelLabel: t('cancel'),
      variant: 'default',
      onConfirm: () => {
        bulkResolve.mutate(
          { conversationIds: ids },
          { onSuccess: () => setSelectedIds(new Set()) },
        );
      },
    });
  }, [selectedIds, bulkResolve, t, confirm]);

  const handleBulkArchive = useCallback(() => {
    const ids = Array.from(selectedIds);
    confirm({
      title: t('bulkArchive', { count: ids.length }),
      message: t('confirmBulkArchive', { count: ids.length }),
      confirmLabel: t('bulkArchive', { count: ids.length }),
      cancelLabel: t('cancel'),
      variant: 'danger',
      onConfirm: () => {
        bulkArchive.mutate(
          { conversationIds: ids },
          { onSuccess: () => setSelectedIds(new Set()) },
        );
      },
    });
  }, [selectedIds, bulkArchive, t, confirm]);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    confirm({
      title: t('bulkDelete', { count: ids.length }),
      message: t('confirmBulkDelete', { count: ids.length }),
      confirmLabel: t('bulkDelete', { count: ids.length }),
      cancelLabel: t('cancel'),
      variant: 'danger',
      onConfirm: () => {
        bulkDelete.mutate(
          { conversationIds: ids },
          { onSuccess: () => setSelectedIds(new Set()) },
        );
      },
    });
  }, [selectedIds, bulkDelete, t, confirm]);

  // =====================================================================
  // RENDER
  // =====================================================================

  return (
    <>
      <div className="-m-4 md:-m-6 flex h-[calc(100vh-theme(spacing.14))] md:h-[calc(100vh-theme(spacing.16))] overflow-hidden">
        {/* LEFT PANEL - Conversation List */}
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          channelId={channelId}
          onChannelChange={setChannelId}
          sentiment={sentiment}
          onSentimentChange={setSentiment}
          category={category}
          onCategoryChange={setCategory}
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
          isLoading={conversationsQuery.isLoading}
          isError={conversationsQuery.isError}
          isFetching={conversationsQuery.isFetching}
          onRefresh={() => conversationsQuery.refetch()}
          onSelect={handleSelectConversation}
          onExport={handleExport}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          toggleSelectAll={toggleSelectAll}
          allSelected={allSelected}
          someSelected={someSelected}
        />

        {/* CENTER PANEL - Chat Window */}
        <section
          className={cn(
            'flex flex-1 flex-col overflow-hidden',
            !selectedConversationId ? 'hidden md:flex' : 'flex',
          )}
        >
          {!selectedConversationId ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={MessagesSquare}
                title={t('selectConversation')}
                description={t('noMessages')}
              />
            </div>
          ) : (
            <>
              <ConversationHeader
                conversation={selectedConversation}
                onBack={() => setSelectedConversationId(null)}
                onHandoff={() => handoff.mutate({ conversationId: selectedConversationId }, { onSuccess: () => toast.success(tc('toast.handedOff')), onError: () => toast.error(tc('toast.handoffFailed')) })}
                onResolve={() => resolve.mutate({ conversationId: selectedConversationId }, { onSuccess: () => toast.success(tc('toast.resolved')), onError: () => toast.error(tc('toast.resolveFailed')) })}
                onReturnToAI={() => returnToAI.mutate({ conversationId: selectedConversationId }, { onSuccess: () => toast.success(tc('toast.returnedToAI')), onError: () => toast.error(tc('toast.returnToAIFailed')) })}
                onDelete={handleDelete}
                onToggleInsights={() => setInsightsOpen((v) => !v)}
                onMobileInsightsOpen={() => setMobileInsightsOpen(true)}
                insightsOpen={insightsOpen}
                isHandoffPending={handoff.isPending}
                isResolvePending={resolve.isPending}
                isReturnToAIPending={returnToAI.isPending}
                isDeletePending={deleteConversation.isPending}
              />

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
                {messagesQuery.isLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {messagesQuery.hasNextPage && (
                  <div className="mb-4 text-center">
                    <button
                      onClick={() => messagesQuery.fetchNextPage()}
                      disabled={messagesQuery.isFetchingNextPage}
                      className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                    >
                      {messagesQuery.isFetchingNextPage ? t('loading') : t('loadMore')}
                    </button>
                  </div>
                )}

                {allMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    copiedMessageId={copiedMessageId}
                    onCopy={handleCopyMessage}
                  />
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="mb-4 flex justify-end">
                    <div className="flex items-center gap-2.5 rounded-lg rounded-br-sm bg-primary/10 px-4 py-3">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
                      </div>
                      <span className="text-xs text-muted-foreground">{t('aiTyping')}</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <MessageInput
                value={messageInput}
                onChange={setMessageInput}
                onSend={handleSend}
                onKeyDown={handleKeyDown}
                onTyping={(typing) => {
                  if (selectedConversationId) emitTyping(selectedConversationId, typing);
                }}
                onFileUpload={handleFileUpload}
                isSending={sendMessage.isPending}
                isUploading={uploadFile.isPending}
              />
            </>
          )}
        </section>

        {/* RIGHT PANEL - AI Insights Sidebar */}
        {selectedConversationId && insightsOpen && (
          <InsightsSidebar
            conversation={selectedConversation}
            currentEmotion={currentEmotion}
            emotionScore={emotionScore}
            currentSummary={currentSummary}
          />
        )}
      </div>

      {/* Mobile AI Insights Drawer */}
      {selectedConversationId && (
        <MobileInsightsDrawer
          open={mobileInsightsOpen}
          onClose={() => setMobileInsightsOpen(false)}
          conversation={selectedConversation}
          currentEmotion={currentEmotion}
          emotionScore={emotionScore}
          currentSummary={currentSummary}
        />
      )}

      {/* Bulk Action Toolbar */}
      {someSelected && (
        <div className="fixed bottom-6 start-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg">
          <span className="text-sm font-medium text-muted-foreground">
            {t('selected', { count: selectedIds.size })}
          </span>
          <div className="h-4 w-px bg-border" />
          <button
            onClick={handleBulkResolve}
            disabled={bulkResolve.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {t('bulkResolve', { count: selectedIds.size })}
          </button>
          <button
            onClick={handleBulkArchive}
            disabled={bulkArchive.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Archive className="h-3.5 w-3.5" />
            {t('bulkArchive', { count: selectedIds.size })}
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDelete.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('bulkDelete', { count: selectedIds.size })}
          </button>
          <button
            onClick={clearSelection}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
            {t('clearSelection')}
          </button>
        </div>
      )}

      <ConfirmDialog {...confirmProps} />
    </>
  );
}
