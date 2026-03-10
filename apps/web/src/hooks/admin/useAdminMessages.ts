'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const adminMessagesKeys = {
  demoRequests: (params?: object) => ['admin', 'demo-requests', params] as const,
  contactMessages: (params?: object) => ['admin', 'contact-messages', params] as const,
};

// Demo Requests
export function useAdminDemoRequests(params: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: adminMessagesKeys.demoRequests(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.status) searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);
      const { data } = await api.get(`/admin/demo-requests?${searchParams}`);
      return data.data;
    },
  });
}

export function useUpdateDemoRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/admin/demo-requests/${id}`, { status });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'demo-requests'] });
    },
  });
}

export function useDeleteDemoRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/demo-requests/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'demo-requests'] });
    },
  });
}

// Contact Messages
export function useAdminContactMessages(params: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: adminMessagesKeys.contactMessages(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.status) searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);
      const { data } = await api.get(`/admin/contact-messages?${searchParams}`);
      return data.data;
    },
  });
}

export function useUpdateContactMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/admin/contact-messages/${id}`, { status });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'contact-messages'] });
    },
  });
}

export function useDeleteContactMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/contact-messages/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'contact-messages'] });
    },
  });
}
