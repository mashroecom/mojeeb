import crypto from 'crypto';
import { prisma } from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { getAIProvider } from '../ai/index';
import { logger } from '../config/logger';
import { cache } from '../config/cache';
import pdfParse from 'pdf-parse';

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
      const response = await fetch(url, {
        headers: { 'User-Agent': 'MojeebBot/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();

      // Simple HTML-to-text: strip tags, decode entities, clean whitespace
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      return text;
    } catch (err) {
      logger.error({ err, url }, 'URL crawling failed');
      throw new BadRequestError('Failed to crawl URL');
    }
  }

  async semanticSearch(kbId: string, query: string, limit: number = 5) {
    const provider = getAIProvider('OPENAI');

    // Cache key for query embedding
    const cacheKey = `kb:embedding:${crypto.createHash('sha256').update(query).digest('hex')}`;

    // Get or generate embedding with cache (24-hour TTL)
    const queryEmbedding = await cache.getOrSet<number[]>(
      cacheKey,
      86400, // 24 hours
      async () => await provider.generateEmbedding(query)
    );

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
}

export const knowledgeBaseService = new KnowledgeBaseService();
