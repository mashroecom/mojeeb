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
        { role: 'CUSTOMER', content: 'Hello', contentType: 'TEXT' },
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
        { role: 'CUSTOMER', content: 'Where is my order?', contentType: 'TEXT' },
        { role: 'AGENT', content: 'Let me check', contentType: 'TEXT' },
        { role: 'CUSTOMER', content: 'I need tracking info', contentType: 'TEXT' },
      ]);

      // Mock templates
      const mockTemplates = [
        {
          id: 'tpl-1',
          title: 'Shipping Inquiry',
          titleAr: 'استفسار شحن',
          content: 'Your order {{order_number}} is on the way',
          contentAr: 'طلبك رقم {{order_number}} في الطريق',
          category: 'shipping',
        },
        {
          id: 'tpl-2',
          title: 'Payment Issue',
          titleAr: 'مشكلة دفع',
          content: 'Payment failed for order {{order_number}}',
          contentAr: 'فشل الدفع للطلب {{order_number}}',
          category: 'payment',
        },
      ];
      vi.mocked(prisma.messageTemplate.findMany).mockResolvedValue(mockTemplates);

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
        titleAr: 'استفسار شحن',
        content: 'Your order {{order_number}} is on the way',
        contentAr: 'طلبك رقم {{order_number}} في الطريق',
        category: 'shipping',
        relevanceScore: 0.9,
        reasoning: 'Customer asking about order tracking',
      });
    });

    it('should filter out templates below relevance threshold (0.3)', async () => {
      vi.mocked(prisma.message.findMany).mockResolvedValue([
        { role: 'CUSTOMER', content: 'Hello', contentType: 'TEXT' },
      ]);

      vi.mocked(prisma.messageTemplate.findMany).mockResolvedValue([
        {
          id: 'tpl-1',
          title: 'Test Template',
          titleAr: 'قالب تجريبي',
          content: 'Test content',
          contentAr: 'محتوى تجريبي',
          category: 'test',
        },
      ]);

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
        { role: 'CUSTOMER', content: 'I need help', contentType: 'TEXT' },
      ]);

      const mockTemplates = [
        {
          id: 'tpl-1',
          title: 'Template 1',
          titleAr: 'قالب 1',
          content: 'Content 1',
          contentAr: 'محتوى 1',
          category: 'test',
        },
        {
          id: 'tpl-2',
          title: 'Template 2',
          titleAr: 'قالب 2',
          content: 'Content 2',
          contentAr: 'محتوى 2',
          category: 'test',
        },
        {
          id: 'tpl-3',
          title: 'Template 3',
          titleAr: 'قالب 3',
          content: 'Content 3',
          contentAr: 'محتوى 3',
          category: 'test',
        },
        {
          id: 'tpl-4',
          title: 'Template 4',
          titleAr: 'قالب 4',
          content: 'Content 4',
          contentAr: 'محتوى 4',
          category: 'test',
        },
      ];
      vi.mocked(prisma.messageTemplate.findMany).mockResolvedValue(mockTemplates);

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
      expect(result[0].id).toBe('tpl-1');
      expect(result[1].id).toBe('tpl-2');
      expect(result[2].id).toBe('tpl-3');
    });

    it('should include both shared and personal templates', async () => {
      vi.mocked(prisma.message.findMany).mockResolvedValue([
        { role: 'CUSTOMER', content: 'Hello', contentType: 'TEXT' },
      ]);

      vi.mocked(prisma.messageTemplate.findMany).mockResolvedValue([
        {
          id: 'tpl-1',
          title: 'Shared Template',
          titleAr: 'قالب مشترك',
          content: 'Shared content',
          contentAr: 'محتوى مشترك',
          category: 'shared',
        },
      ]);

      mockAIProvider.generateJSON.mockResolvedValue({
        suggestions: [],
      });

      await pipeline.suggest({
        conversationId: 'conv-123',
        orgId: 'org-123',
        userId: 'user-123',
      });

      expect(prisma.messageTemplate.findMany).toHaveBeenCalledWith({
        where: {
          orgId: 'org-123',
          isActive: true,
          OR: [
            { isShared: true },
            { userId: 'user-123' },
          ],
        },
        select: {
          id: true,
          title: true,
          titleAr: true,
          content: true,
          contentAr: true,
          category: true,
        },
        take: 20,
      });
    });

    it('should filter SYSTEM messages from context', async () => {
      vi.mocked(prisma.message.findMany).mockResolvedValue([
        { role: 'CUSTOMER', content: 'Hello', contentType: 'TEXT' },
        { role: 'SYSTEM', content: 'Agent joined', contentType: 'TEXT' },
        { role: 'AGENT', content: 'How can I help?', contentType: 'TEXT' },
      ]);

      vi.mocked(prisma.messageTemplate.findMany).mockResolvedValue([
        {
          id: 'tpl-1',
          title: 'Test',
          titleAr: 'اختبار',
          content: 'Test',
          contentAr: 'اختبار',
          category: 'test',
        },
      ]);

      mockAIProvider.generateJSON.mockResolvedValue({
        suggestions: [],
      });

      await pipeline.suggest({
        conversationId: 'conv-123',
        orgId: 'org-123',
      });

      const aiCall = mockAIProvider.generateJSON.mock.calls[0][0];
      const promptContent = aiCall.messages[0].content;

      // Should not contain SYSTEM message
      expect(promptContent).not.toContain('system: Agent joined');
      expect(promptContent).toContain('user: Hello');
      expect(promptContent).toContain('assistant: How can I help?');
    });

    it('should annotate non-text content types', async () => {
      vi.mocked(prisma.message.findMany).mockResolvedValue([
        { role: 'CUSTOMER', content: 'image.jpg', contentType: 'IMAGE' },
        { role: 'CUSTOMER', content: 'video.mp4', contentType: 'VIDEO' },
        { role: 'CUSTOMER', content: 'audio.mp3', contentType: 'AUDIO' },
      ]);

      vi.mocked(prisma.messageTemplate.findMany).mockResolvedValue([
        {
          id: 'tpl-1',
          title: 'Test',
          titleAr: 'اختبار',
          content: 'Test',
          contentAr: 'اختبار',
          category: 'test',
        },
      ]);

      mockAIProvider.generateJSON.mockResolvedValue({
        suggestions: [],
      });

      await pipeline.suggest({
        conversationId: 'conv-123',
        orgId: 'org-123',
      });

      const aiCall = mockAIProvider.generateJSON.mock.calls[0][0];
      const promptContent = aiCall.messages[0].content;

      expect(promptContent).toContain('[Customer sent image: image.jpg]');
      expect(promptContent).toContain('[Customer sent video: video.mp4]');
      expect(promptContent).toContain('[Customer sent audio: audio.mp3]');
    });

    it('should return empty array on AI failure', async () => {
      vi.mocked(prisma.message.findMany).mockResolvedValue([
        { role: 'CUSTOMER', content: 'Hello', contentType: 'TEXT' },
      ]);

      vi.mocked(prisma.messageTemplate.findMany).mockResolvedValue([
        {
          id: 'tpl-1',
          title: 'Test',
          titleAr: 'اختبار',
          content: 'Test',
          contentAr: 'اختبار',
          category: 'test',
        },
      ]);

      mockAIProvider.generateJSON.mockRejectedValue(new Error('AI service error'));

      const result = await pipeline.suggest({
        conversationId: 'conv-123',
        orgId: 'org-123',
      });

      expect(result).toEqual([]);
    });

    it('should sort suggestions by relevance score (highest first)', async () => {
      vi.mocked(prisma.message.findMany).mockResolvedValue([
        { role: 'CUSTOMER', content: 'Help me', contentType: 'TEXT' },
      ]);

      const mockTemplates = [
        {
          id: 'tpl-1',
          title: 'Template 1',
          titleAr: 'قالب 1',
          content: 'Content 1',
          contentAr: 'محتوى 1',
          category: 'test',
        },
        {
          id: 'tpl-2',
          title: 'Template 2',
          titleAr: 'قالب 2',
          content: 'Content 2',
          contentAr: 'محتوى 2',
          category: 'test',
        },
        {
          id: 'tpl-3',
          title: 'Template 3',
          titleAr: 'قالب 3',
          content: 'Content 3',
          contentAr: 'محتوى 3',
          category: 'test',
        },
      ];
      vi.mocked(prisma.messageTemplate.findMany).mockResolvedValue(mockTemplates);

      // Return in unsorted order
      mockAIProvider.generateJSON.mockResolvedValue({
        suggestions: [
          { templateId: 'tpl-2', relevance: 0.5, reasoning: 'Medium relevance' },
          { templateId: 'tpl-1', relevance: 0.9, reasoning: 'High relevance' },
          { templateId: 'tpl-3', relevance: 0.7, reasoning: 'Good relevance' },
        ],
      });

      const result = await pipeline.suggest({
        conversationId: 'conv-123',
        orgId: 'org-123',
      });

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('tpl-1'); // Highest relevance (0.9)
      expect(result[1].id).toBe('tpl-3'); // Medium relevance (0.7)
      expect(result[2].id).toBe('tpl-2'); // Lowest relevance (0.5)
      expect(result[0].relevanceScore).toBe(0.9);
      expect(result[1].relevanceScore).toBe(0.7);
      expect(result[2].relevanceScore).toBe(0.5);
    });
  });
});
