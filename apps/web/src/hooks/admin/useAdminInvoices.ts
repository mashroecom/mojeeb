'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const adminInvoiceKeys = {
  all: ['admin', 'invoices'] as const,
  lists: () => [...adminInvoiceKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...adminInvoiceKeys.lists(), params] as const,
  details: () => [...adminInvoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminInvoiceKeys.details(), id] as const,
  stats: () => [...adminInvoiceKeys.all, 'stats'] as const,
};

export function useAdminInvoices(params: { page: number; limit: number; orgId?: string; status?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: adminInvoiceKeys.list(params),
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
      if (params.orgId) sp.set('orgId', params.orgId);
      if (params.status) sp.set('status', params.status);
      if (params.startDate) sp.set('startDate', params.startDate);
      if (params.endDate) sp.set('endDate', params.endDate);
      const { data } = await api.get(`/admin/invoices?${sp}`);
      return data.data;
    },
  });
}

export function useAdminInvoiceDetail(invoiceId: string) {
  return useQuery({
    queryKey: adminInvoiceKeys.detail(invoiceId),
    queryFn: async () => {
      const { data } = await api.get(`/admin/invoices/${invoiceId}`);
      return data.data;
    },
    enabled: !!invoiceId,
  });
}

export function useAdminInvoiceStats() {
  return useQuery({
    queryKey: adminInvoiceKeys.stats(),
    queryFn: async () => {
      const { data } = await api.get('/admin/invoices/stats');
      return data.data;
    },
  });
}

export function useUpdateAdminInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, ...body }: { invoiceId: string; status: string }) => {
      const { data } = await api.patch(`/admin/invoices/${invoiceId}`, body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminInvoiceKeys.all });
    },
  });
}
