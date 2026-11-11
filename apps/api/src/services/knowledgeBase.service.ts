import crypto from 'crypto';
import { prisma } from '../config/database';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';
import { getAIProvider } from '../ai/index';
import { logger } from '../config/logger';
import { cache } from '../config/cache';
import pdfParse from 'pdf-parse';
import { crawlerService, CRAWL_ERROR_CODES } from './crawler.service';
import { crawlerQueue } from '../queues/index';
import {
  scheduleRepeatableCrawl,
  cancelRepeatableCrawl,
  findScheduledCrawlTarget,
  failStaleCrawlJobs,
} from '../queues/workers/crawler.worker';
import {
  CRAWL_SCHEDULE_TIMEZONE,
  computeNextCrawlAt,
  frequencyToCronPattern,
  isCrawlFrequency,
} from '../queues/crawlSchedule';
import { parseUrlPatterns, serializeUrlPatterns } from '../utils/urlPatterns';

export class KnowledgeBaseService {
  async create(orgId: string, data: { name: string; description?: string }) {
    return prisma.knowledgeBase.create({
      data: { orgId, name: data.name, description: data.description },
    });
  }

  async list(orgId: string) {
    return prisma.knowledgeBase.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { documents: true } } },
    });
  }

  async getById(orgId: string, kbId: string) {
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: kbId, orgId },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        agents: { include: { agent: { select: { id: true, name: true } } } },
      },
    });
    if (!kb) throw new NotFoundError('Knowledge base not found');
    return kb;
  }

  async update(orgId: string, kbId: string, data: { name?: string; description?: string }) {
    const kb = await prisma.knowledgeBase.findFirst({ where: { id: kbId, orgId } });
    if (!kb) throw new NotFoundError('Knowledge base not found');

    return prisma.knowledgeBase.update({
      where: { id: kbId },
      data,
    });
  }

  async delete(orgId: string, kbId: string) {
    const kb = await prisma.knowledgeBase.findFirst({ where: { id: kbId, orgId } });
    if (!kb) throw new NotFoundError('Knowledge base not found');
    return prisma.knowledgeBase.delete({ where: { id: kbId } });
  }

  async addDocument(
    kbId: string,
    data: {
      title: string;
      content?: string;
      contentType?: string;
      sourceUrl?: string;
      fileBase64?: string;
    },
  ) {
    let textContent = data.content || '';
    const contentType = data.contentType || 'TEXT';

    // Handle PDF: parse base64-encoded PDF file
    if (contentType === 'PDF' && data.fileBase64) {
      textContent = await this.parsePDF(data.fileBase64);
    }

    // Handle URL: crawl the webpage and extract text
    if (contentType === 'URL' && data.sourceUrl) {
      textContent = await this.crawlURL(data.sourceUrl);
      if (!textContent.trim()) {
        throw new BadRequestError(
          'No readable text was found on this page',
          CRAWL_ERROR_CODES.emptyContent,
        );
      }
    }

    if (!textContent.trim()) {
      throw new BadRequestError('Could not extract text content from the provided source');
    }

    const document = await prisma.kBDocument.create({
      data: {
        knowledgeBaseId: kbId,
        title: data.title,
        content: textContent,
        contentType: contentType as any,
        sourceUrl: data.sourceUrl,
        embeddingStatus: 'PENDING',
      },
    });

    // Process document asynchronously
    this.processDocument(document.id).catch((err) => {
      logger.error({ err, documentId: document.id }, 'Document processing failed');
    });

    return document;
  }

  private async parsePDF(base64Data: string): Promise<string> {
    try {
      const buffer = Buffer.from(base64Data, 'base64');

      // Timeout PDF parsing to prevent DoS via malicious PDFs
      const result = await Promise.race([
        (pdfParse as any)(buffer),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('PDF parsing timed out')), 30000),
        ),
      ]);

      return result.text;
    } catch (err) {
      logger.error({ err }, 'PDF parsing failed');
      throw new BadRequestError('Failed to parse PDF file');
    }
  }

  private async crawlURL(url: string): Promise<string> {
    // crawlUrl only throws BadRequestErrors that say why the page was refused
    // (robots.txt, not HTML, private address, ...) with a CRAWL_* code the
    // dashboard translates — let them through instead of a generic failure.
    const result = await crawlerService.crawlUrl(url, { respectRobotsTxt: true });
    return result.text;
  }

  async semanticSearch(kbId: string, query: string, limit: number = 5) {
    const provider = getAIProvider('OPENAI');

    // Cache key for query embedding
    const cacheKey = `kb:embedding:${crypto.createHash('sha256').update(query).digest('hex')}`;

    // Get or generate embedding with cache (24-hour TTL)
    const queryEmbedding = await cache.getOrSet<number[]>(
      cacheKey,
      86400, // 24 hours
      async () => await provider.generateEmbedding(query),
    );

    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Find documents that belong to this KB
    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        content: string;
        chunkIndex: number;
        documentId: string;
        score: number;
        documentTitle: string;
      }>
    >`
      SELECT c.id, c.content, c."chunkIndex", c."documentId",
             1 - (c.embedding <=> ${embeddingStr}::vector) as score,
             d.title as "documentTitle"
      FROM kb_chunks c
      JOIN kb_documents d ON d.id = c."documentId"
      WHERE d."knowledgeBaseId" = ${kbId}
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `;

    return results;
  }

  async deleteDocument(kbId: string, docId: string) {
    const doc = await prisma.kBDocument.findFirst({
      where: { id: docId, knowledgeBaseId: kbId },
    });
    if (!doc) throw new NotFoundError('Document not found');
    return prisma.kBDocument.delete({ where: { id: docId } });
  }

  /**
   * The crawl configuration of a knowledge base. There is exactly one per
   * knowledge base (the oldest, should older data hold several): it remembers
   * the depth and URL filter of the latest completed website crawl and carries
   * the auto-sync schedule.
   */
  private async getCrawlConfig(kbId: string) {
    return prisma.crawlConfig.findFirst({
      where: { knowledgeBaseId: kbId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Start a multi-page crawl: create the job row, linked to the knowledge
   * base's crawl config, and enqueue it for the crawler worker.
   */
  async startCrawlJob(
    kbId: string,
    data: {
      startUrl: string;
      maxDepth?: number;
      urlPatterns?: string[];
      /** Comma-separated form, kept for older clients. */
      urlPattern?: string;
    },
  ) {
    // Validate knowledge base exists
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: kbId },
      select: { id: true, orgId: true },
    });
    if (!kb) throw new NotFoundError('Knowledge base not found');

    // Refuse URLs the crawler would refuse anyway (not http(s), private or
    // unresolvable host) now, with a clear error, instead of in a failed job.
    await crawlerService.assertCrawlableUrl(data.startUrl);

    // Two crawls writing the same pages into one knowledge base would race and
    // duplicate documents: one at a time. Jobs abandoned by a dead process do
    // not count.
    await failStaleCrawlJobs(kbId);
    const active = await prisma.crawlJob.findFirst({
      where: { knowledgeBaseId: kbId, status: { in: ['PENDING', 'RUNNING'] } },
      select: { id: true },
    });
    if (active) {
      throw new ConflictError(
        'A crawl is already in progress for this knowledge base',
        'CRAWL_ALREADY_RUNNING',
      );
    }

    const urlPatterns = parseUrlPatterns(data.urlPatterns ?? data.urlPattern);
    const maxDepth = data.maxDepth ?? 1;

    // Every crawl is linked to the knowledge base's one crawl config. The
    // worker copies this crawl's depth and URL filter onto it when the crawl
    // completes, so auto-sync always repeats the last *completed* crawl (site
    // and settings together) and a cancelled or failed attempt changes nothing.
    const config =
      (await this.getCrawlConfig(kbId)) ??
      (await prisma.crawlConfig.create({
        data: { knowledgeBaseId: kbId, maxDepth, urlPattern: serializeUrlPatterns(urlPatterns) },
      }));

    const crawlJob = await prisma.crawlJob.create({
      data: {
        knowledgeBaseId: kbId,
        startUrl: data.startUrl,
        configId: config.id,
        status: 'PENDING',
        pagesTotal: 0,
        pagesCrawled: 0,
      },
      include: {
        config: true,
      },
    });

    // Enqueue crawl job to BullMQ
    try {
      await crawlerQueue.add('crawl', {
        jobId: crawlJob.id,
        kbId: kb.id,
        orgId: kb.orgId,
        startUrl: data.startUrl,
        configId: config.id,
        config: { maxDepth, urlPatterns },
      });
    } catch (err) {
      // Never leave a job row that no worker will ever pick up
      await prisma.crawlJob.update({
        where: { id: crawlJob.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Could not queue the crawl',
          completedAt: new Date(),
        },
      });
      throw err;
    }

    logger.info(
      { jobId: crawlJob.id, kbId, startUrl: data.startUrl, maxDepth, urlPatterns },
      'Crawl job enqueued',
    );

    return crawlJob;
  }

  async getCrawlJobStatus(jobId: string) {
    const job = await prisma.crawlJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        startUrl: true,
        pagesCrawled: true,
        pagesTotal: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        knowledgeBase: {
          select: { id: true, name: true },
        },
      },
    });
    if (!job) throw new NotFoundError('Crawl job not found');
    return job;
  }

  async getCrawlJob(jobId: string) {
    const job = await prisma.crawlJob.findUnique({
      where: { id: jobId },
      include: {
        config: true,
        knowledgeBase: {
          select: { id: true, name: true },
        },
      },
    });
    if (!job) throw new NotFoundError('Crawl job not found');
    return job;
  }

  /**
   * Cancel a crawl job that has not finished yet. The crawler worker checks the
   * job status between pages and stops as soon as it sees CANCELLED; pages that
   * were already imported are kept.
   */
  async cancelCrawlJob(jobId: string) {
    const { count } = await prisma.crawlJob.updateMany({
      where: { id: jobId, status: { in: ['PENDING', 'RUNNING'] } },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });

    const job = await this.getCrawlJobStatus(jobId);
    if (count === 0 && job.status !== 'CANCELLED') {
      throw new ConflictError(`Crawl job already ${job.status.toLowerCase()}`);
    }
    return job;
  }

  async listCrawlJobs(kbId: string) {
    // Most recent first; the dashboard shows the latest handful
    return prisma.crawlJob.findMany({
      where: { knowledgeBaseId: kbId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Re-run embedding for a document that is not searchable yet (failed, or left
   * pending/processing by a crash or a provider outage). Runs in the background;
   * poll the document's embeddingStatus.
   */
  async reprocessDocument(kbId: string, docId: string) {
    const doc = await prisma.kBDocument.findFirst({
      where: { id: docId, knowledgeBaseId: kbId },
      select: { id: true, embeddingStatus: true },
    });
    if (!doc) throw new NotFoundError('Document not found');
    if (doc.embeddingStatus === 'COMPLETED') {
      throw new ConflictError('Document is already processed');
    }

    const updated = await prisma.kBDocument.update({
      where: { id: docId },
      data: { embeddingStatus: 'PENDING' },
    });

    this.processDocument(docId).catch((err) => {
      logger.error({ err, documentId: docId }, 'Document reprocessing failed');
    });

    return updated;
  }

  /**
   * Chunk a document, embed every chunk and store the vectors. Until this has
   * completed the document is invisible to semantic search. Safe to call again:
   * chunks from an earlier (partial) attempt are replaced.
   */
  async processDocument(documentId: string) {
    await prisma.kBDocument.update({
      where: { id: documentId },
      data: { embeddingStatus: 'PROCESSING' },
    });

    try {
      const document = await prisma.kBDocument.findUnique({
        where: { id: documentId },
      });
      if (!document) return;

      // Drop chunks left behind by an earlier attempt so a retry never duplicates them
      await prisma.kBChunk.deleteMany({ where: { documentId } });

      // Chunk the document
      const chunks = this.chunkText(document.content, 500, 50);

      // Generate embeddings and store chunks
      const provider = getAIProvider('OPENAI');

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await provider.generateEmbedding(chunks[i]!);
        const chunkId = crypto.randomUUID();
        const embeddingStr = `[${embedding.join(',')}]`;

        await prisma.$executeRaw`
          INSERT INTO kb_chunks (id, "documentId", content, embedding, "chunkIndex", metadata, "createdAt")
          VALUES (${chunkId}, ${documentId}, ${chunks[i]!}, ${embeddingStr}::vector, ${i}, '{}'::jsonb, NOW())
        `;
      }

      await prisma.kBDocument.update({
        where: { id: documentId },
        data: {
          embeddingStatus: 'COMPLETED',
          chunkCount: chunks.length,
        },
      });

      logger.info({ documentId, chunkCount: chunks.length }, 'Document processed');
    } catch (err) {
      logger.error({ err, documentId }, 'Document processing failed');
      await prisma.kBDocument.update({
        where: { id: documentId },
        data: { embeddingStatus: 'FAILED' },
      });
    }
  }

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let start = 0;

    while (start < words.length) {
      const end = Math.min(start + chunkSize, words.length);
      chunks.push(words.slice(start, end).join(' '));
      start += chunkSize - overlap;
    }

    return chunks;
  }

  /**
   * What the dashboard needs to show about auto-sync: the stored config plus
   * the site that will be re-crawled and a next-run time derived from the cron
   * pattern actually scheduled (never a stale stored value).
   */
  private describeCrawlSchedule(
    config: Awaited<ReturnType<KnowledgeBaseService['getCrawlConfig']>>,
    startUrl: string | null,
  ) {
    const frequency =
      config?.scheduleEnabled && isCrawlFrequency(config.scheduleFrequency)
        ? config.scheduleFrequency
        : null;

    return {
      id: config?.id ?? null,
      knowledgeBaseId: config?.knowledgeBaseId ?? null,
      maxDepth: config?.maxDepth ?? 1,
      urlPattern: config?.urlPattern ?? null,
      scheduleEnabled: frequency !== null,
      scheduleFrequency: frequency,
      lastCrawledAt: config?.lastCrawledAt ?? null,
      nextCrawlAt: frequency ? computeNextCrawlAt(frequency) : null,
      cronPattern: frequency ? frequencyToCronPattern(frequency) : null,
      timezone: CRAWL_SCHEDULE_TIMEZONE,
      /** Site auto-sync re-crawls; null until a website has been crawled. */
      startUrl,
      createdAt: config?.createdAt ?? null,
      updatedAt: config?.updatedAt ?? null,
    };
  }

  /**
   * Switch auto-sync on/off or change its frequency. Auto-sync repeats the
   * knowledge base's latest completed website crawl (same start URL, depth and
   * URL filter), so there must be one before it can be enabled.
   */
  async updateCrawlSchedule(
    kbId: string,
    data: {
      frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      enabled: boolean;
    },
  ) {
    // Validate knowledge base exists
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: kbId },
      select: { id: true },
    });
    if (!kb) throw new NotFoundError('Knowledge base not found');

    // Validate required fields when enabling schedule
    if (data.enabled && !data.frequency) {
      throw new BadRequestError('Frequency is required when enabling schedule');
    }

    const startUrl = await findScheduledCrawlTarget(kbId);
    if (data.enabled && !startUrl) {
      throw new BadRequestError(
        'Crawl a website into this knowledge base first: auto-sync re-crawls the last crawled website',
        'CRAWL_SCHEDULE_NO_SITE',
      );
    }

    let config = await this.getCrawlConfig(kbId);
    if (!config && !data.enabled) {
      // Nothing was ever scheduled: disabling is a no-op
      return this.describeCrawlSchedule(null, startUrl);
    }

    const scheduleData = {
      scheduleEnabled: data.enabled,
      scheduleFrequency: data.enabled ? data.frequency : null,
    };
    config = config
      ? await prisma.crawlConfig.update({ where: { id: config.id }, data: scheduleData })
      : await prisma.crawlConfig.create({ data: { knowledgeBaseId: kbId, ...scheduleData } });

    // Schedule (replacing any previous frequency) or cancel the repeatable job
    if (data.enabled) {
      await scheduleRepeatableCrawl(config.id);
    } else {
      await cancelRepeatableCrawl(config.id);
    }

    logger.info(
      { kbId, configId: config.id, enabled: data.enabled, frequency: data.frequency },
      'Crawl schedule updated',
    );

    return this.describeCrawlSchedule(await this.getCrawlConfig(kbId), startUrl);
  }

  async getCrawlSchedule(kbId: string) {
    const [config, startUrl] = await Promise.all([
      this.getCrawlConfig(kbId),
      findScheduledCrawlTarget(kbId),
    ]);
    return this.describeCrawlSchedule(config, startUrl);
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
