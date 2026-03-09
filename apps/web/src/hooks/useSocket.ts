'use client';
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { conversationKeys } from '@/hooks/useConversations';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { organization, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organization) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      path: '/ws',
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:org', organization.id);
    });

    socket.on('message:new', (data) => {
      useChatStore.getState().addMessage(data.conversationId, {
        id: data.messageId,
        role: data.role,
        content: data.content,
        contentType: data.contentType,
        createdAt: data.createdAt,
      });
      // Refresh conversations list so new messages appear instantly
      queryClient.invalidateQueries({
        queryKey: conversationKeys.all(organization.id),
      });
    });

    socket.on('conversation:updated', (data) => {
      useChatStore.getState().updateConversation(data.conversationId, data);
      // Refresh conversations list on status/emotion/summary changes
      queryClient.invalidateQueries({
        queryKey: conversationKeys.all(organization.id),
      });
    });

    socket.on('typing:start', (data) => {
      useChatStore.getState().setTyping(data.conversationId, true);
    });

    socket.on('typing:stop', (data) => {
      useChatStore.getState().setTyping(data.conversationId, false);
    });

    return () => {
      socket.off('connect');
      socket.off('message:new');
      socket.off('conversation:updated');
      socket.off('typing:start');
      socket.off('typing:stop');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [organization, isAuthenticated]);

  const joinConversation = (conversationId: string) => {
    socketRef.current?.emit('join:conversation', conversationId);
  };

  const leaveConversation = (conversationId: string) => {
    socketRef.current?.emit('leave:conversation', conversationId);
  };

  const emitTyping = (conversationId: string, isTyping: boolean) => {
    socketRef.current?.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
  };

  return { socket: socketRef, joinConversation, leaveConversation, emitTyping };
}
