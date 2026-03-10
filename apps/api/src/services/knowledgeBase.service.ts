import crypto from 'crypto';
import { prisma } from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { getAIProvider } from '../ai/index';
import { logger } from '../config/logger';
import pdfParse from 'pdf-parse';
import { crawlerService } from './crawler.service';
import { crawlerQueue } from '../queues/index';
import { scheduleRepeatableCrawl, cancelRepeatableCrawl } from '../queues/workers/crawler.worker';

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

  async addDocument(kbId: string, data: {
    title: string;
    content?: string;
    contentType?: string;
    sourceUrl?: string;
    fileBase64?: string;
  }) {
    let textContent = data.content || '';
    const contentType = data.contentType || 'TEXT';

    // Handle PDF: parse base64-encoded PDF file
    if (contentType === 'PDF' && data.fileBase64) {
      textContent = await this.parsePDF(data.fileBase64);
    }

    // Handle URL: crawl the webpage and extract text
    if (contentType === 'URL' && data.sourceUrl) {
      textContent = await this.crawlURL(data.sourceUrl);
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
    try {
      // Use the new crawler service with cheerio-based extraction
      const result = await crawlerService.crawlUrl(url, {
        respectRobotsTxt: true,
      });

      return result.text;
    } catch (err) {
      logger.error({ err, url }, 'URL crawling failed');
      throw new BadRequestError('Failed to crawl URL');
    }
  }

  async semanticSearch(kbId: string, query: string, limit: number = 5) {
    const provider = getAIProvider('OPENAI');
    const queryEmbedding = await provider.generateEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Find documents that belong to this KB
    const results = await prisma.$queryRaw<
      Array<{ id: string; content: string; chunkIndex: number; documentId: string; score: number; documentTitle: string }>
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

  async createCrawlJob(
    kbId: string,
    data: {
      startUrl: string;
      maxDepth?: number;
      urlPattern?: string;
      configId?: string;
    }
  ) {
    // Validate knowledge base exists
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: kbId },
    });
    if (!kb) throw new NotFoundError('Knowledge base not found');

    // Validate URL
    try {
      new URL(data.startUrl);
    } catch (err) {
      throw new BadRequestError('Invalid URL format');
    }

    // Create crawl job
    const crawlJob = await prisma.crawlJob.create({
      data: {
        knowledgeBaseId: kbId,
        startUrl: data.startUrl,
        configId: data.configId,
        status: 'PENDING',
        pagesTotal: 0,
        pagesCrawled: 0,
      },
      include: {
        config: true,
      },
    });

    return crawlJob;
  }

  async startCrawlJob(
    kbId: string,
    data: {
      startUrl: string;
      maxDepth?: number;
      urlPattern?: string;
      configId?: string;
    }
  ) {
    // Validate knowledge base exists
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: kbId },
      select: { id: true, orgId: true },
    });
    if (!kb) throw new NotFoundError('Knowledge base not found');

    // Validate URL
    try {
      new URL(data.startUrl);
    } catch (err) {
      throw new BadRequestError('Invalid URL format');
    }

    // Parse URL patterns if provided
    let urlPatterns: string[] = [];
    if (data.urlPattern) {
      urlPatterns = data.urlPattern.split(',').map((p) => p.trim()).filter(Boolean);
    }

    // Create crawl job in database
    const crawlJob = await prisma.crawlJob.create({
      data: {
        knowledgeBaseId: kbId,
        startUrl: data.startUrl,
        configId: data.configId,
        status: 'PENDING',
        pagesTotal: 0,
        pagesCrawled: 0,
      },
      include: {
        config: true,
      },
    });

    // Get URL patterns from config if not provided directly
    let configUrlPatterns = urlPatterns;
    if (configUrlPatterns.length === 0 && crawlJob.config?.urlPattern) {
      configUrlPatterns = crawlJob.config.urlPattern
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    }

    // Enqueue crawl job to BullMQ
    await crawlerQueue.add('crawl', {
      jobId: crawlJob.id,
      kbId: kb.id,
      orgId: kb.orgId,
      startUrl: data.startUrl,
      config: {
        maxDepth: data.maxDepth || crawlJob.config?.maxDepth || 1,
        urlPatterns: configUrlPatterns,
      },
    });

    logger.info({ jobId: crawlJob.id, kbId, startUrl: data.startUrl }, 'Crawl job enqueued');

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

  async listCrawlJobs(kbId: string) {
    return prisma.crawlJob.findMany({
      where: { knowledgeBaseId: kbId },
      orderBy: { createdAt: 'desc' },
      include: {
        config: true,
      },
    });
  }

  private async processDocument(documentId: string) {
    await prisma.kBDocument.update({
      where: { id: documentId },
      data: { embeddingStatus: 'PROCESSING' },
    });

    try {
      const document = await prisma.kBDocument.findUnique({
        where: { id: documentId },
      });
      if (!document) return;

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

  async updateCrawlSchedule(
    kbId: string,
    data: {
      frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      enabled: boolean;
      maxDepth?: number;
      urlPattern?: string;
      startUrl?: string;
    }
  ) {
    // Validate knowledge base exists
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: kbId },
      include: { crawlConfigs: true },
    });
    if (!kb) throw new NotFoundError('Knowledge base not found');

    // Validate required fields when enabling schedule
    if (data.enabled && !data.frequency) {
      throw new BadRequestError('Frequency is required when enabling schedule');
    }

    // Find existing config or create new one
    let config = kb.crawlConfigs[0]; // For now, support one config per KB

    if (config) {
      // Update existing config
      config = await prisma.crawlConfig.update({
        where: { id: config.id },
        data: {
          scheduleEnabled: data.enabled,
          scheduleFrequency: data.enabled ? data.frequency : null,
          maxDepth: data.maxDepth ?? config.maxDepth,
          urlPattern: data.urlPattern ?? config.urlPattern,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new config
      if (data.enabled && !data.startUrl) {
        throw new BadRequestError('Start URL is required for new crawl configuration');
      }

      config = await prisma.crawlConfig.create({
        data: {
          knowledgeBaseId: kbId,
          scheduleEnabled: data.enabled,
          scheduleFrequency: data.enabled ? data.frequency : null,
          maxDepth: data.maxDepth ?? 1,
          urlPattern: data.urlPattern,
        },
      });
    }

    // Schedule or cancel repeatable crawl job
    if (data.enabled) {
      await scheduleRepeatableCrawl(config.id);
    } else {
      await cancelRepeatableCrawl(config.id);
    }

    logger.info(
      { kbId, configId: config.id, enabled: data.enabled, frequency: data.frequency },
      'Crawl schedule updated'
    );

    return config;
  }

  async getCrawlSchedule(kbId: string) {
    // Validate knowledge base exists
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: kbId },
      include: { crawlConfigs: true },
    });
    if (!kb) throw new NotFoundError('Knowledge base not found');

    // Return first config (for now, support one config per KB)
    const config = kb.crawlConfigs[0];
    if (!config) {
      return null;
    }

    return config;
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
