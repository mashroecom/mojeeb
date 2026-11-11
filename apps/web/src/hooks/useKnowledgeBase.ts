'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KBDocument {
  id: string;
  title: string;
  content: string;
  contentType: 'TEXT' | 'FAQ' | 'PDF' | 'URL';
  sourceUrl: string | null;
  embeddingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  chunkCount: number;
  createdAt: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { documents: number };
  documents?: KBDocument[];
}

interface ApiResponse<T> {
  success: true;
  data: T;
}

// Mutation payloads
interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
}

interface UpdateKnowledgeBaseInput {
  kbId: string;
  name?: string;
  description?: string;
}

interface AddDocumentInput {
  kbId: string;
  title: string;
  content?: string;
  contentType?: 'TEXT' | 'FAQ' | 'PDF' | 'URL';
  sourceUrl?: string;
  fileBase64?: string;
}

interface DeleteDocumentInput {
  kbId: string;
  docId: string;
}

// Search
export interface SearchResult {
  id: string;
  title: string;
  content: string;
  score: number;
}

interface SearchKBInput {
  kbId: string;
  query: string;
  limit?: number;
}

// Bulk import
interface BulkImportInput {
  kbId: string;
  documents: Array<{ title: string; content: string; contentType?: 'TEXT' | 'FAQ' }>;
}

// Crawl Schedule (auto-sync)
export type CrawlFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface CrawlSchedule {
  /** null until the knowledge base has a crawl configuration */
  id: string | null;
  knowledgeBaseId: string | null;
  /** Depth and URL filter (comma-separated) of the latest website crawl */
  maxDepth: number;
  urlPattern: string | null;
  scheduleEnabled: boolean;
  scheduleFrequency: CrawlFrequency | null;
  lastCrawledAt: string | null;
  /** Next scheduled run (ISO, derived from the cron pattern); null when disabled */
  nextCrawlAt: string | null;
  cronPattern: string | null;
  /** Time zone the schedule runs in (UTC) */
  timezone: string;
  /** Website auto-sync re-crawls; null until a website has been crawled */
  startUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface UpdateCrawlScheduleInput {
  kbId: string;
  enabled: boolean;
  frequency?: CrawlFrequency;
}

// Crawl Jobs
export interface CrawlJob {
  id: string;
  knowledgeBaseId: string;
  configId: string | null;
  startUrl: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  pagesTotal: number;
  pagesCrawled: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function isCrawlJobActive(job: Pick<CrawlJob, 'status'>): boolean {
  return job.status === 'PENDING' || job.status === 'RUNNING';
}

interface StartCrawlInput {
  kbId: string;
  startUrl: string;
  maxDepth?: number;
  /** Only links whose address matches one of these filters are followed */
  urlPatterns?: string[];
}

interface CancelCrawlJobInput {
  kbId: string;
  jobId: string;
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const knowledgeBaseKeys = {
  all: (orgId: string) => ['organizations', orgId, 'knowledge-bases'] as const,
  detail: (orgId: string, kbId: string) =>
    ['organizations', orgId, 'knowledge-bases', kbId] as const,
  schedule: (orgId: string, kbId: string) =>
    ['organizations', orgId, 'knowledge-bases', kbId, 'schedule'] as const,
  crawlJobs: (orgId: string, kbId: string) =>
    ['organizations', orgId, 'knowledge-bases', kbId, 'crawl-jobs'] as const,
  crawlJob: (orgId: string, kbId: string, jobId: string) =>
    ['organizations', orgId, 'knowledge-bases', kbId, 'crawl-jobs', jobId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List all knowledge bases for the current organization.
 */
export function useKnowledgeBases() {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: knowledgeBaseKeys.all(orgId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<KnowledgeBase[]>>(
        `/organizations/${orgId}/knowledge-bases`,
      );
      return data.data;
    },
    enabled: !!orgId,
  });
}

/**
 * Fetch a single knowledge base by ID.
 */
export function useKnowledgeBase(
  kbId: string | undefined,
  options: { crawlActive?: boolean } = {},
) {
  const orgId = useAuthStore((s) => s.organization?.id);
  const { crawlActive = false } = options;

  return useQuery({
    queryKey: knowledgeBaseKeys.detail(orgId!, kbId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<KnowledgeBase>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}`,
      );
      return data.data;
    },
    enabled: !!orgId && !!kbId,
    // Embedding runs in the background: keep polling while any document is still
    // being processed so its status and chunk count update without a manual reload.
    // A running website crawl keeps adding documents, so poll during it as well.
    refetchInterval: (query) =>
      crawlActive ||
      query.state.data?.documents?.some(
        (doc) => doc.embeddingStatus === 'PENDING' || doc.embeddingStatus === 'PROCESSING',
      )
        ? 3000
        : false,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a new knowledge base. Invalidates the KB list on success.
 */
export function useCreateKnowledgeBase() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async (input: CreateKnowledgeBaseInput) => {
      const { data } = await api.post<ApiResponse<KnowledgeBase>>(
        `/organizations/${orgId}/knowledge-bases`,
        input,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all(orgId) });
      }
    },
  });
}

/**
 * Update a knowledge base (name/description).
 */
export function useUpdateKnowledgeBase() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async ({ kbId, ...body }: UpdateKnowledgeBaseInput) => {
      const { data } = await api.patch<ApiResponse<KnowledgeBase>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}`,
        body,
      );
      return data.data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: knowledgeBaseKeys.detail(orgId, variables.kbId),
        });
        queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all(orgId) });
      }
    },
  });
}

/**
 * Delete a knowledge base. Invalidates the KB list on success.
 */
export function useDeleteKnowledgeBase() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async (kbId: string) => {
      const { data } = await api.delete<ApiResponse<void>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}`,
      );
      return data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all(orgId) });
      }
    },
  });
}

/**
 * Add a document to a knowledge base.
 * Invalidates both the single KB detail and the KB list on success.
 */
export function useAddDocument() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async ({ kbId, ...body }: AddDocumentInput) => {
      const { data } = await api.post<ApiResponse<KBDocument>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}/documents`,
        body,
      );
      return data.data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: knowledgeBaseKeys.detail(orgId, variables.kbId),
        });
        queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all(orgId) });
      }
    },
  });
}

/**
 * Delete a document from a knowledge base.
 * Invalidates both the single KB detail and the KB list on success.
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async ({ kbId, docId }: DeleteDocumentInput) => {
      const { data } = await api.delete<ApiResponse<void>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}/documents/${docId}`,
      );
      return data.data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: knowledgeBaseKeys.detail(orgId, variables.kbId),
        });
        queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all(orgId) });
      }
    },
  });
}

/**
 * Retry embedding for a document that failed (or never finished) processing.
 * The work runs in the background; the detail query polls until it settles.
 */
export function useReprocessDocument() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async ({ kbId, docId }: DeleteDocumentInput) => {
      const { data } = await api.post<ApiResponse<KBDocument>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}/documents/${docId}/reprocess`,
      );
      return data.data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: knowledgeBaseKeys.detail(orgId, variables.kbId),
        });
      }
    },
  });
}

/**
 * Search within a knowledge base using semantic/vector search.
 */
export function useSearchKB() {
  const orgId = useAuthStore((s) => s.organization?.id);
  return useMutation({
    mutationFn: async ({ kbId, query, limit }: SearchKBInput) => {
      const { data } = await api.post<ApiResponse<SearchResult[]>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}/search`,
        { query, limit },
      );
      return data.data;
    },
  });
}

/**
 * Bulk import documents into a knowledge base.
 * Invalidates both the single KB detail and the KB list on success.
 */
export function useBulkImportDocuments() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);
  return useMutation({
    mutationFn: async ({ kbId, documents }: BulkImportInput) => {
      const { data } = await api.post<ApiResponse<KBDocument[]>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}/documents/bulk`,
        { documents },
      );
      return data.data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: knowledgeBaseKeys.detail(orgId, variables.kbId),
        });
        queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all(orgId) });
      }
    },
  });
}

/**
 * Fetch crawl schedule configuration for a knowledge base.
 */
export function useCrawlSchedule(kbId: string | undefined) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: knowledgeBaseKeys.schedule(orgId!, kbId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<CrawlSchedule>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}/crawl/schedule`,
      );
      return data.data;
    },
    enabled: !!orgId && !!kbId,
  });
}

/**
 * Update crawl schedule configuration.
 * Invalidates the schedule query on success.
 */
export function useUpdateCrawlSchedule() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async ({ kbId, ...body }: UpdateCrawlScheduleInput) => {
      const { data } = await api.post<ApiResponse<CrawlSchedule>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}/crawl/schedule`,
        body,
      );
      return data.data;
    },
    onSuccess: (data, variables) => {
      if (orgId) {
        queryClient.setQueryData(knowledgeBaseKeys.schedule(orgId, variables.kbId), data);
        queryClient.invalidateQueries({
          queryKey: knowledgeBaseKeys.schedule(orgId, variables.kbId),
        });
      }
    },
  });
}

/**
 * Start a new crawl job for a knowledge base.
 * Invalidates crawl jobs list on success.
 */
export function useStartCrawl() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async ({ kbId, ...body }: StartCrawlInput) => {
      const { data } = await api.post<ApiResponse<CrawlJob>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}/crawl`,
        body,
      );
      return data.data;
    },
    onSuccess: (_data, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: knowledgeBaseKeys.crawlJobs(orgId, variables.kbId),
        });
        // The crawl settings (and the site auto-sync follows) just changed
        queryClient.invalidateQueries({
          queryKey: knowledgeBaseKeys.schedule(orgId, variables.kbId),
        });
      }
    },
  });
}

/**
 * List the most recent crawl jobs of a knowledge base (newest first). Polls
 * quickly while a crawl is queued or running so its progress is live, and
 * slowly otherwise so a crawl started elsewhere (auto-sync, another tab)
 * still shows up.
 */
export function useCrawlJobs(kbId: string | undefined) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: knowledgeBaseKeys.crawlJobs(orgId!, kbId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<CrawlJob[]>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}/crawl`,
      );
      return data.data;
    },
    enabled: !!orgId && !!kbId,
    refetchInterval: (query) => (query.state.data?.some(isCrawlJobActive) ? 2000 : 30000),
  });
}

/**
 * Fetch a single crawl job by ID.
 */
export function useCrawlJob(kbId: string | undefined, jobId: string | undefined) {
  const orgId = useAuthStore((s) => s.organization?.id);

  return useQuery({
    queryKey: knowledgeBaseKeys.crawlJob(orgId!, kbId!, jobId!),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<CrawlJob>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}/crawl/${jobId}`,
      );
      return data.data;
    },
    enabled: !!orgId && !!kbId && !!jobId,
  });
}

/**
 * Cancel a running crawl job.
 * Invalidates both the job detail and jobs list on success.
 */
export function useCancelCrawlJob() {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.organization?.id);

  return useMutation({
    mutationFn: async ({ kbId, jobId }: CancelCrawlJobInput) => {
      const { data } = await api.delete<ApiResponse<Pick<CrawlJob, 'id' | 'status'>>>(
        `/organizations/${orgId}/knowledge-bases/${kbId}/crawl/${jobId}`,
      );
      return data.data;
    },
    // Also on error: a 409 means the job finished in the meantime
    onSettled: (_data, _error, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({
          queryKey: knowledgeBaseKeys.crawlJob(orgId, variables.kbId, variables.jobId),
        });
        queryClient.invalidateQueries({
          queryKey: knowledgeBaseKeys.crawlJobs(orgId, variables.kbId),
        });
      }
    },
  });
}
