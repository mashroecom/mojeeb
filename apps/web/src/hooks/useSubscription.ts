'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Subscription {
  id: string;
  plan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
  messagesUsed: number;
  messagesLimit: number;
  agentsUsed: number;
  agentsLimit: number;
  integrationsUsed: number;
  integrationsLimit: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export interface Invoice {
  id: string;
  amount: string;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  paidAt: string | null;
  dueDate: string;
  createdAt: string;
}

export const subscriptionKeys = {
  detail: (orgId: string) => ['organizations', orgId, 'subscription'] as const,
  invoices: (orgId: string) => ['organizations', orgId, 'subscription', 'invoices'] as const,
};

// ---------------------------------------------------------------------------
// useSubscription
// ---------------------------------------------------------------------------

export function useSubscription() {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: subscriptionKeys.detail(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Subscription>>(
        `/organizations/${orgId}/subscription`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}

export function useInvoices() {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: subscriptionKeys.invoices(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ invoices: Invoice[]; pagination: any }>>(
        `/organizations/${orgId}/subscription/invoices`,
      );
      return data.data.invoices;
    },
    enabled: !!orgId,
  });
}

// ---------------------------------------------------------------------------
// Public plans (no auth required)
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface PlanData {
  plan: string;
  displayName: string;
  displayNameAr: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  messagesPerMonth: number;
  maxAgents: number;
  maxChannels: number;
  maxKnowledgeBases: number;
  maxTeamMembers: number;
  apiAccess: boolean;
  isPopular: boolean;
  features: string;
  featuresAr: string;
}

export function usePlans() {
  return useQuery({
    queryKey: ['public', 'plans'],
    queryFn: async () => {
      const { data } = await axios.get<ApiResponse<PlanData[]>>(
        `${API_BASE}/public/plans`,
      );
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Payment Gateways
// ---------------------------------------------------------------------------

export interface PaymentGatewayInfo {
  gateway: 'KASHIER' | 'STRIPE' | 'PAYPAL';
  displayName: string;
  enabled: boolean;
  description?: string;
}

export function usePaymentGateways() {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: ['organizations', orgId, 'subscription', 'available-gateways'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<PaymentGatewayInfo[]>>(
        `/organizations/${orgId}/subscription/available-gateways`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}
