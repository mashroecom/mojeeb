import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TemplateSuggestionPipeline } from './templateSuggestion.pipeline';
import { prisma } from '../../config/database';
import { getAIProvider } from '../index';

// Mock dependencies
vi.mock('../../config/database', () => ({
  prisma: {
    message: {
      findMany: vi.fn(),
    },
    messageTemplate: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../index', () => ({
  getAIProvider: vi.fn(),
}));

vi.mock('../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TemplateSuggestionPipeline', () => {
  let pipeline: TemplateSuggestionPipeline;
  let mockAIProvider: any;

  beforeEach(() => {
    pipeline = new TemplateSuggestionPipeline();

    // Setup mock AI provider
    mockAIProvider = {
      generateJSON: vi.fn(),
    };
    vi.mocked(getAIProvider).mockReturnValue(mockAIProvider);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('suggest', () => {
    it('should return empty array when no messages exist', async () => {
      vi.mocked(prisma.message.findMany).mockResolvedValue([]);

      const result = await pipeline.suggest({
        conversationId: 'conv-123',
        orgId: 'org-123',
      });

      expect(result).toEqual([]);
      expect(prisma.messageTemplate.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array when no templates exist', async () => {
      vi.mocked(prisma.message.findMany).mockResolvedValue([
        { role: 'CUSTOMER', content: 'Hello', contentType: 'TEXT' } as any,
      ]);
      vi.mocked(prisma.messageTemplate.findMany).mockResolvedValue([]);

      const result = await pipeline.suggest({
        conversationId: 'conv-123',
        orgId: 'org-123',
      });

      expect(result).toEqual([]);
      expect(mockAIProvider.generateJSON).not.toHaveBeenCalled();
    });

    it('should suggest relevant templates based on conversation', async () => {
      // Mock messages
      vi.mocked(prisma.message.findMany).mockResolvedValue([
        { role: 'CUSTOMER', content: 'Where is my order?', contentType: 'TEXT' } as any,
        { role: 'HUMAN_AGENT', content: 'Let me check', contentType: 'TEXT' } as any,
        { role: 'CUSTOMER', content: 'I need tracking info', contentType: 'TEXT' } as any,
      ]);

      // Mock templates
      const mockTemplates = [
        {
          id: 'tpl-1',
          title: 'Shipping Inquiry',
          contentEn: 'Your order {{order_number}} is on the way',
          contentAr: 'طلبك رقم {{order_number}} في الطريق',
          category: 'shipping',
        },
        {
          id: 'tpl-2',
          title: 'Payment Issue',
          contentEn: 'Payment failed for order {{order_number}}',
          contentAr: 'فشل الدفع للطلب {{order_number}}',
          category: 'payment',
        },
      ];
      vi.mocked(prisma.messageTemplate.findMany).mockResolvedValue(mockTemplates as any);

      // Mock AI response
      mockAIProvider.generateJSON.mockResolvedValue({
        suggestions: [
          {
            templateId: 'tpl-1',
            relevance: 0.9,
            reasoning: 'Customer asking about order tracking',
          },
        ],
      });

      const result = await pipeline.suggest({
        conversationId: 'conv-123',
        orgId: 'org-123',
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'tpl-1',
        title: 'Shipping Inquiry',
        contentEn: 'Your order {{order_number}} is on the way',
        contentAr: 'طلبك رقم {{order_number}} في الطريق',
        category: 'shipping',
        relevanceScore: 0.9,
        reasoning: 'Customer asking about order tracking',
      });
    });

    it('should filter out templates below relevance threshold (0.3)', async () => {
      vi.mocked(prisma.message.findMany).mockResolvedValue([
        { role: 'CUSTOMER', content: 'Hello', contentType: 'TEXT' } as any,
      ]);

      vi.mocked(prisma.messageTemplate.findMany).mockResolvedValue([
        {
          id: 'tpl-1',
          title: 'Test Template',
          contentEn: 'Test content',
          contentAr: 'محتوى تجريبي',
          category: 'test',
        },
      ] as any);

      mockAIProvider.generateJSON.mockResolvedValue({
        suggestions: [
          {
            templateId: 'tpl-1',
            relevance: 0.2, // Below threshold
            reasoning: 'Not very relevant',
          },
        ],
      });

      const result = await pipeline.suggest({
        conversationId: 'conv-123',
        orgId: 'org-123',
      });

      expect(result).toEqual([]);
    });

    it('should return max 3 templates even if more are suggested', async () => {
      vi.mocked(prisma.message.findMany).mockResolvedValue([
        { role: 'CUSTOMER', content: 'I need help', contentType: 'TEXT' } as any,
      ]);

      const mockTemplates = [
        {
          id: 'tpl-1',
          title: 'Template 1',
          contentEn: 'Content 1',
          contentAr: 'محتوى 1',
          category: 'test',
        },
        {
          id: 'tpl-2',
          title: 'Template 2',
          contentEn: 'Content 2',
          contentAr: 'محتوى 2',
          category: 'test',
        },
        {
          id: 'tpl-3',
          title: 'Template 3',
          contentEn: 'Content 3',
          contentAr: 'محتوى 3',
          category: 'test',
        },
        {
          id: 'tpl-4',
          title: 'Template 4',
          contentEn: 'Content 4',
          contentAr: 'محتوى 4',
          category: 'test',
        },
      ];
      vi.mocked(prisma.messageTemplate.findMany).mockResolvedValue(mockTemplates as any);

      mockAIProvider.generateJSON.mockResolvedValue({
        suggestions: [
          { templateId: 'tpl-1', relevance: 0.9, reasoning: 'Relevant 1' },
          { templateId: 'tpl-2', relevance: 0.8, reasoning: 'Relevant 2' },
          { templateId: 'tpl-3', relevance: 0.7, reasoning: 'Relevant 3' },
          { templateId: 'tpl-4', relevance: 0.6, reasoning: 'Relevant 4' },
        ],
      });

      const result = await pipeline.suggest({
        conversationId: 'conv-123',
        orgId: 'org-123',
      });

      expect(result).toHaveLength(3);
      expect(result[0]!.id).toBe('tpl-1');
      expect(result[1]!.id).toBe('tpl-2');
      expect(result[2]!.id).toBe('tpl-3');
    });

    it('should include both shared and personal templates', async () => {
      vi.mocked(prisma.message.findMany).mockResolvedValue([
        { role: 'CUSTOMER', content: 'Hello', contentType: 'TEXT' } as any,
      ]);

      vi.mocked(prisma.messageTemplate.findMany).mockResolvedValue([
        {
          id: 'tpl-1',
          title: 'Shared Template',
          contentEn: 'Shared content',
          contentAr: 'محتوى مشترك',
          category: 'shared',
        },
      ] as any);

      mockAIProvider.generateJSON.mockResolvedValue({
        suggestions: [],
      });

      await pipeline.suggest({
        conversationId: 'conv-123',
        orgId: 'org-123
