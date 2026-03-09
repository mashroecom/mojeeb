'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { MessageSquare, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
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

export default function ConversationsPage() {
  const t = useTranslations('dashboard.conversations');
  const locale = useLocale();

  // ---- Local state ----
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [messageInput, setMessageInput] = useState('');
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [mobileInsightsOpen, setMobileInsightsOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

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

  // ---- React Query ----
  const conversationsQuery = useConversations({
    status: STATUS_FILTER_MAP[statusFilter],
    limit: 50,
    search: debouncedSearch || undefined,
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
          { onSuccess: () => setSelectedConversationId(null) },
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
                blob ? resolve(blob) : reject(new Error('Failed to convert'));
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
          isLoading={conversationsQuery.isLoading}
          isError={conversationsQuery.isError}
          isFetching={conversationsQuery.isFetching}
          onRefresh={() => conversationsQuery.refetch()}
          onSelect={handleSelectConversation}
          onExport={handleExport}
        />

        {/* CENTER PANEL - Chat Window */}
        <section
          className={cn(
            'flex flex-1 flex-col overflow-hidden',
            !selectedConversationId ? 'hidden md:flex' : 'flex',
          )}
        >
          {!selectedConversationId ? (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">{t('selectConversation')}</p>
            </div>
          ) : (
            <>
              <ConversationHeader
                conversation={selectedConversation}
                onBack={() => setSelectedConversationId(null)}
                onHandoff={() => handoff.mutate({ conversationId: selectedConversationId })}
                onResolve={() => resolve.mutate({ conversationId: selectedConversationId })}
                onReturnToAI={() => returnToAI.mutate({ conversationId: selectedConversationId })}
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
              <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4">
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
                  <div className="mb-3 flex justify-end">
                    <div className="flex items-center gap-2 rounded-xl rounded-ee-none bg-primary/10 px-4 py-2.5">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
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
                conversationId={selectedConversationId}
                customerName={selectedConversation?.customerName}
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

      <ConfirmDialog {...confirmProps} />
    </>
  );
}
