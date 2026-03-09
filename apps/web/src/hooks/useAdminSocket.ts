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

interface AgentAvailability {
  agentId: string;
  agentName: string;
  status: 'online' | 'offline';
  activeConversations: number;
  lastActiveAt: Date | null;
}

interface TeamMetrics {
  activeConversations: number;
  queueDepth: number;
  averageWaitTimeMs: number;
  agentsOnline: number;
  activeAgents: AgentAvailability[];
}

export function useAdminSocket() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [teamMetrics, setTeamMetrics] = useState<TeamMetrics | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const clearEvents = useCallback(() => setEvents([]), []);

  const subscribeTeamMetrics = useCallback((orgId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('team:metrics:subscribe', orgId);
  }, []);

  const unsubscribeTeamMetrics = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('team:metrics:unsubscribe');
  }, []);

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

    socket.on('team:metrics:update', (metrics: TeamMetrics) => {
      setTeamMetrics(metrics);
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

  return {
    events,
    connected,
    clearEvents,
    teamMetrics,
    subscribeTeamMetrics,
    unsubscribeTeamMetrics,
  };
}
