'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CustomerChannel = 'WHATSAPP' | 'MESSENGER' | 'INSTAGRAM' | 'WEBCHAT';

export const CUSTOMER_CHANNELS: CustomerChannel[] = [
  'WHATSAPP',
  'MESSENGER',
  'INSTAGRAM',
  'WEBCHAT',
];

/**
 * A customer is derived from conversations and identified by channel type + the
 * channel's own customer identifier. `id` is the opaque, URL-safe key for it.
 */
export interface Customer {
  id: string;
  customerId: string;
  channel: CustomerChannel;
  channels: CustomerChannel[];
  name: string | null;
  email: string | null;
  phone: string | null;
  conversationCount: number;
  firstSeenAt: string;
  lastActiveAt: string;
  lastEmotion: string | null;
}

export type CustomerConversationStatus =
  | 'ACTIVE'
  | 'HANDED_OFF'
  | 'WAITING'
  | 'RESOLVED'
  | 'ARCHIVED';

export interface CustomerConversation {
  id: string;
  status: CustomerConversationStatus;
  summary: string | null;
  lastEmotion: string | null;
  messageCount: number;
  firstMessageAt: string;
  lastMessageAt: string;
  resolvedAt: string | null;
  channel: { id: string; name: string; type: CustomerChannel };
  rating: number | null;
}

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
  conversationCount: number;
}

export interface CustomerNote {
  id: string;
  conversationId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string } | null;
}

export interface CustomerLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  confidence: number;
  conversationId: string | null;
  createdAt: string;
}

export interface CustomerProfile extends Customer {
  totalConversations: number;
  conversationsByStatus: Partial<Record<CustomerConversationStatus, number>>;
  avgRating: number | null;
  ratingsCount: number;
  /** Most recent conversations (the API caps this list at 100). */
  conversations: CustomerConversation[];
  tags: CustomerTag[];
  notes: CustomerNote[];
  leads: CustomerLead[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiResponse<T> {
  success: true;
  data: T;
  pagination?: Pagination;
}

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export interface CustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  channel?: CustomerChannel;
  order?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const customerKeys = {
  all: (orgId: string) => ['organizations', orgId, 'customers'] as const,
  list: (orgId: string, params?: CustomersParams) =>
    [...customerKeys.all(orgId), 'list', params ?? {}] as const,
  detail: (orgId: string, customerId: string) =>
    [...customerKeys.all(orgId), 'detail', customerId] as const,
};

// ---------------------------------------------------------------------------
// useCustomers - paginated list
// ---------------------------------------------------------------------------

export function useCustomers(params?: CustomersParams) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: customerKeys.list(orgId!, params),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Customer[]>>(`/organizations/${orgId}/customers`, {
        params,
      });
      return data;
    },
    enabled: !!orgId,
    // Keep the current rows on screen while the next page / filter loads.
    placeholderData: keepPreviousData,
  });
}

// ---------------------------------------------------------------------------
// useCustomer - profile
// ---------------------------------------------------------------------------

export function useCustomer(customerId: string | undefined) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: customerKeys.detail(orgId!, customerId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<CustomerProfile>>(
        `/organizations/${orgId}/customers/${encodeURIComponent(customerId!)}`,
      );
      return data.data;
    },
    enabled: !!orgId && !!customerId,
    // A 404 is a definitive answer; don't retry it.
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 2,
  });
}

export function isNotFoundError(error: unknown): boolean {
  return (error as { response?: { status?: number } } | null)?.response?.status === 404;
}

// ---------------------------------------------------------------------------
// useExportCustomers - server-side CSV of every customer matching the filters
// ---------------------------------------------------------------------------

export function useExportCustomers() {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async (filters: Pick<CustomersParams, 'search' | 'channel'>) => {
      const { data } = await api.get<Blob>(`/organizations/${orgId}/customers/export`, {
        params: filters,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
  });
}
