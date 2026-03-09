'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface AdminEvent {
  id: string;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export function useAdminSocket() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const clearEvents = useCallback(() => setEvents([]), []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(`${API_URL}/admin`, {
      path: '/ws',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('admin:event', (event: AdminEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 200));
    });

    return () => {
      // BUG FIX: remove event listeners before disconnect to prevent memory leaks
      socket.off('connect');
      socket.off('disconnect');
      socket.off('admin:event');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { events, connected, clearEvents };
}
