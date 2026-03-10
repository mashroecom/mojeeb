'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { adminKeys } from '../useAdmin';

// ===== Email Templates =====
export function useAdminEmailTemplates() {
  return useQuery({
    queryKey: adminKeys.emailTemplates,
    queryFn: async () => {
      const { data } = await api.get('/admin/email-templates');
      return data.data;
    },
  });
}

export function useUpsertEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      key,
      ...body
    }: {
      key: string;
      subject: string;
      subjectAr?: string;
      bodyHtml: string;
      bodyHtmlAr?: string;
      bodyText?: string;
      variables?: string[];
    }) => {
      const { data } = await api.put(`/admin/email-templates/${key}`, body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] });
    },
  });
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { data } = await api.delete(`/admin/email-templates/${key}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] });
    },
  });
}

export function useSeedEmailTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/admin/email-templates/seed');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] });
    },
  });
}

// ===== Bulk Email =====
export function useAdminBulkEmails(params: { page: number; limit: number }) {
  return useQuery({
    queryKey: adminKeys.bulkEmail(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      const { data } = await api.get(`/admin/bulk-email?${searchParams}`);
      return data.data;
    },
  });
}

export function useAdminBulkEmailDetail(id: string) {
  return useQuery({
    queryKey: adminKeys.bulkEmailDetail(id),
    queryFn: async () => {
      const { data } = await api.get(`/admin/bulk-email/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateBulkEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { subject: string; bodyHtml: string; targetFilter?: object }) => {
      const { data } = await api.post('/admin/bulk-email', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bulk-email'] });
    },
  });
}

export function useSendBulkEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/admin/bulk-email/${id}/send`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bulk-email'] });
    },
  });
}

export function useCancelBulkEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/admin/bulk-email/${id}/cancel`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bulk-email'] });
    },
  });
}

export function useRecipientCount(params: {
  plan?: string;
  status?: string;
  emailVerified?: boolean;
}) {
  return useQuery({
    queryKey: adminKeys.recipientCount(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.plan) searchParams.set('plan', params.plan);
      if (params.status) searchParams.set('status', params.status);
      if (params.emailVerified !== undefined)
        searchParams.set('emailVerified', String(params.emailVerified));
      const { data } = await api.get(`/admin/bulk-email/recipient-count?${searchParams}`);
      return data.data;
    },
  });
}
