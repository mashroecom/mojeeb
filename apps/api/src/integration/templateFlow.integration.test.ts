/**
 * End-to-End Integration Test: Canned Responses & Quick Reply Templates
 *
 * This test verifies the complete flow:
 * 1. Create bilingual template with variables
 * 2. Fetch templates (simulate / keyboard shortcut)
 * 3. Get AI suggestions based on conversation context
 * 4. Interpolate template variables
 * 5. Track template usage analytics
 * 6. Verify analytics show incremented usage count
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../config/database';
import { TemplateInterpolationService } from '../services/templateInterpolation.service';
import { TemplateSuggestionPipeline } from '../ai/pipelines/templateSuggestion.pipeline';

// This is an integration test, but we still mock external AI calls to avoid dependencies
vi.mock('../index', () => ({
  getAIProvider: vi.fn(() => ({
    generateJSON: vi.fn(),
  })),
}));

vi.mock('../config/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Template Flow E2E Integration', () => {
  let testOrgId: string;
  let testUserId: string;
  let testConversationId: string;
  let englishTemplateId: string;
  let arabicTemplateId: string;

  // Clean up test data before each test
  beforeEach(async () => {
    testOrgId = `test-org-${Date.now()}`;
    testUserId = `test-user-${Date.now()}`;
    testConversationId = `test-conv-${Date.now()}`;

    // Clean up any existing test data
    await prisma.messageTemplate.deleteMany({
      where: { orgId: { contains: 'test-org-' } },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.messageTemplate.deleteMany({
      where: { orgId: { contains: 'test-org-' } },
    });
    await prisma.message.deleteMany({
      where: { conversationId: { contains: 'test-conv-' } },
    });
  });

  describe('Step 1: Create bilingual templates with variables', () => {
    it('should create an English template with variables', async () => {
      const template = await prisma.messageTemplate.create({
        data: {
          orgId: testOrgId,
          createdBy: testUserId,
          title: 'Order Status Inquiry',
          contentEn:
            'Hello {{customer_name}}! Your order {{order_number}} is currently being processed by {{agent_name}}. We will notify you once it ships.',
          category: 'product_info',
          shortcut: '/order-status',
          variables: ['customer_name', 'order_number', 'agent_name'],
          isActive: true,
          usageCount: 0,
        },
      });

      englishTemplateId = template.id;

      expect(template).toBeDefined();
      expect(template.title).toBe('Order Status Inquiry');
      expect(template.contentEn).toContain('{{customer_name}}');
      expect(template.contentEn).toContain('{{order_number}}');
      expect(template.contentEn).toContain('{{agent_name}}');
      expect(template.variables).toEqual(['customer_name', 'order_number', 'agent_name']);
      expect(template.isActive).toBe(true);
      expect(template.usageCount).toBe(0);
    });

    it('should create an Arabic template with variables', async () => {
      const template = await prisma.messageTemplate.create({
        data: {
          orgId: testOrgId,
          createdBy: testUserId,
          title: 'Order Status Inquiry AR',
          contentEn:
            'Hello {{customer_name}}! Your order {{order_number}} is being handled.',
          contentAr:
            'مرحباً {{customer_name}}! طلبك رقم {{order_number}} قيد المعالجة بواسطة {{agent_name}}. سنخطرك فور الشحن.',
          category: 'product_info',
          shortcut: '/order-status-ar',
          variables: ['customer_name', 'order_number', 'agent_name'],
          isActive: true,
          usageCount: 0,
        },
      });

      arabicTemplateId = template.id;

      expect(template).toBeDefined();
      expect(template.contentAr).toContain('مرحباً');
      expect(template.contentAr).toContain('{{customer_name}}');
      expect(template.variables).toEqual(['customer_name', 'order_number', 'agent_name']);
    });

    it('should create a greeting template without variables', async () => {
      const template = await prisma.messageTemplate.create({
        data: {
          orgId: testOrgId,
          createdBy: testUserId,
          title: 'Welcome Message',
          contentEn: 'Thank you for contacting us! How can we help you today?',
          contentAr: 'شكراً لتواصلك معنا! كيف يمكننا مساعدتك اليوم؟',
          category: 'greeting',
          shortcut: '/welcome',
          variables: [],
          isActive: true,
          usageCount: 0,
        },
      });

      expect(template).toBeDefined();
      expect(template.variables).toEqual([]);
    });

    it('should create a personal template', async () => {
      const template = await prisma.messageTemplate.create({
        data: {
          orgId: testOrgId,
          createdBy: testUserId,
          title: 'My Personal Template',
          contentEn: 'This is my personal quick reply for {{customer_name}}',
          category: 'troubleshooting',
          shortcut: '/personal',
          variables: ['customer_name'],
          isActive: true,
          usageCount: 0,
        },
      });

      expect(template).toBeDefined();
      expect(template.createdBy).toBe(testUserId);
    });
  });

  describe('Step 2: Fetch templates (simulate / keyboard shortcut)', () => {
    beforeEach(async () => {
      // Create test templates
      await prisma.messageTemplate.createMany({
        data: [
          {
            orgId: testOrgId,
            createdBy: testUserId,
            title: 'Greeting',
            contentEn: 'Hello! How can I help?',
            category: 'greeting',
            shortcut: '/hi',
            variables: [],
            isActive: true,
            usageCount: 5,
          },
          {
            orgId: testOrgId,
            createdBy: testUserId,
            title: 'Order Status',
            contentEn: 'Your order {{order_number}} is on the way',
            category: 'product_info',
            shortcut: '/status',
            variables: ['order_number'],
            isActive: true,
            usageCount: 10,
          },
          {
            orgId: testOrgId,
            createdBy: testUserId,
            title: 'Inactive Template',
            contentEn: 'This should not appear',
            category: 'troubleshooting',
            shortcut: '/inactive',
            variables: [],
            isActive: false, // Inactive
            usageCount: 0,
          },
        ],
      });
    });

    it('should fetch only active templates for the organization', async () => {
      const templates = await prisma.messageTemplate.findMany({
        where: {
          orgId: testOrgId,
          isActive: true,
        },
        orderBy: { usageCount: 'desc' },
      });

      expect(templates).toHaveLength(2);
      expect(templates[0].title).toBe('Order Status'); // Highest usage count
      expect(templates[1].title).toBe('Greeting');
      expect(templates.find((t) => t.title === 'Inactive Template')).toBeUndefined();
    });

    it('should filter templates by category', async () => {
      const greetingTemplates = await prisma.messageTemplate.findMany({
        where: {
          orgId: testOrgId,
          isActive: true,
          category: 'greeting',
        },
      });

      expect(greetingTemplates).toHaveLength(1);
      expect(greetingTemplates[0].title).toBe('Greeting');
    });

    it('should search templates by title or content', async () => {
      const searchResults = await prisma.messageTemplate.findMany({
        where: {
          orgId: testOrgId,
          isActive: true,
          OR: [
            { title: { contains: 'Order', mode: 'insensitive' } },
            { contentEn: { contains: 'order', mode: 'insensitive' } },
          ],
        },
      });

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].title).toBe('Order Status');
    });

    it('should include templates created by user', async () => {
      // Create a personal template
      await prisma.messageTemplate.create({
        data: {
          orgId: testOrgId,
          createdBy: testUserId,
          title: 'Personal Template',
          contentEn: 'My personal template',
          category: 'troubleshooting',
          shortcut: '/personal',
          variables: [],
          isActive: true,
          usageCount: 0,
        },
      });

      const templates = await prisma.messageTemplate.findMany({
        where: {
          orgId: testOrgId,
          isActive: true,
        },
      });

      expect(templates.length).toBeGreaterThanOrEqual(3);
      expect(templates.find((t) => t.title === 'Personal Template')).toBeDefined();
    });
  });

  describe('Step 3: AI suggestions based on conversation context', () => {
    beforeEach(async () => {
      // Create conversation messages
      await prisma.message.createMany({
        data: [
          {
            conversationId: testConversationId,
            role: 'CUSTOMER',
            content: 'Where is my order?',
            contentType: 'TEXT',
            createdAt: new Date(Date.now() - 3000),
          },
          {
            conversationId: testConversationId,
            role: 'HUMAN_AGENT',
            content: 'Let me check that for you.',
            contentType: 'TEXT',
            createdAt: new Date(Date.now() - 2000),
          },
          {
            conversationId: testConversationId,
            role: 'CUSTOMER',
            content: 'I need tracking information please',
            contentType: 'TEXT',
            createdAt: new Date(Date.now() - 1000),
          },
        ],
      });

      // Create templates
      await prisma.messageTemplate.createMany({
        data: [
          {
            orgId: testOrgId,
            title: 'Order Tracking',
            contentEn: 'Your order {{order_number}} tracking: {{tracking_link}}',
            contentAr: 'رقم تتبع طلبك {{order_number}}: {{tracking_link}}',
            category: 'product_info',
            variables: ['order_number', 'tracking_link'],
            isActive: true,
            usageCount: 0,
          },
          {
            orgId: testOrgId,
            title: 'Payment Issue',
            contentEn: 'There was an issue with your payment',
            contentAr: 'حدثت مشكلة في الدفع',
            category: 'troubleshooting',
            variables: [],
            isActive: true,
            usageCount: 0,
          },
        ],
      });
    });

    it('should fetch conversation context (last 3 messages)', async () => {
      const messages = await prisma.message.findMany({
        where: { conversationId: testConversationId },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('I need tracking information please');
      expect(messages[1].content).toBe('Let me check that for you.');
      expect(messages[2].content).toBe('Where is my order?');
    });

    it('should filter out SYSTEM messages from context', async () => {
      // Add a SYSTEM message
      await prisma.message.create({
        data: {
          conversationId: testConversationId,
          role: 'SYSTEM',
          content: 'Agent joined the conversation',
          contentType: 'TEXT',
          createdAt: new Date(),
        },
      });

      const messages = await prisma.message.findMany({
        where: {
          conversationId: testConversationId,
          NOT: { role: 'SYSTEM' },
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });

      expect(messages.every((m) => m.role !== 'SYSTEM')).toBe(true);
    });

    it('should get AI suggestions using template pipeline', async () => {
      const pipeline = new TemplateSuggestionPipeline();

      // Mock the AI provider response
      const { getAIProvider } = await import('../index');
      const mockAIProvider = vi.mocked(getAIProvider)();
      vi.mocked(mockAIProvider.generateJSON).mockResolvedValue({
        suggestions: [
          {
            templateId: (await prisma.messageTemplate.findFirst({
              where: { orgId: testOrgId, title: 'Order Tracking' },
            }))!.id,
            relevance: 0.9,
            reasoning: 'Customer is asking about order location and tracking',
          },
        ],
      });

      const suggestions = await pipeline.suggest({
        conversationId: testConversationId,
        orgId: testOrgId,
      });

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].title).toBe('Order Tracking');
      expect(suggestions[0].relevanceScore).toBe(0.9);
      expect(suggestions[0].reasoning).toContain('tracking');
    });
  });

  describe('Step 4: Interpolate template variables', () => {
    let service: TemplateInterpolationService;

    beforeEach(() => {
      service = new TemplateInterpolationService();
    });

    it('should interpolate English template with customer data', () => {
      const template =
        'Hello {{customer_name}}! Your order {{order_number}} is being processed by {{agent_name}}.';
      const variables = {
        customer_name: 'Sarah Ahmed',
        order_number: '#12345',
        agent_name: 'John Smith',
      };

      const result = service.interpolate(template, variables);

      expect(result).toBe(
        'Hello Sarah Ahmed! Your order #12345 is being processed by John Smith.'
      );
      expect(result).not.toContain('{{');
    });

    it('should interpolate Arabic template with customer data', () => {
      const template = 'مرحباً {{customer_name}}! طلبك رقم {{order_number}} قيد المعالجة.';
      const variables = {
        customer_name: 'أحمد محمد',
        order_number: '#54321',
      };

      const result = service.interpolate(template, variables);

      expect(result).toBe('مرحباً أحمد محمد! طلبك رقم #54321 قيد المعالجة.');
    });

    it('should interpolate bilingual template', () => {
      const template = {
        content: 'Hello {{customer_name}}, your order {{order_number}} is ready',
        contentAr: 'مرحباً {{customer_name}}، طلبك {{order_number}} جاهز',
      };
      const variables = {
        customer_name: 'Fatima',
        order_number: '#99999',
      };

      const result = service.interpolateBilingual(template, variables);

      expect(result.content).toBe('Hello Fatima, your order #99999 is ready');
      expect(result.contentAr).toBe('مرحباً Fatima، طلبك #99999 جاهز');
    });

    it('should preserve placeholders for missing variables', () => {
      const template = 'Hello {{customer_name}}, your order {{order_number}} status';
      const variables = {
        customer_name: 'John',
        // order_number is missing
      };

      const result = service.interpolate(template, variables);

      expect(result).toBe('Hello John, your order {{order_number}} status');
    });

    it('should validate all required variables are provided', () => {
      const template = 'Agent {{agent_name}} handling conversation {{conversation_id}}';
      const variables = {
        agent_name: 'Alice',
        // conversation_id is missing
      };

      const validation = service.validate(template, variables);

      expect(validation.isValid).toBe(false);
      expect(validation.missing).toEqual(['conversation_id']);
    });

    it('should extract all variables from template', () => {
      const template =
        'Hi {{customer_name}}, order {{order_number}} with agent {{agent_name}}';

      const extracted = service.extractVariables(template);

      expect(extracted).toEqual(['customer_name', 'order_number', 'agent_name']);
    });
  });

  describe('Step 5: Track template usage', () => {
    let templateId: string;

    beforeEach(async () => {
      const template = await prisma.messageTemplate.create({
        data: {
          orgId: testOrgId,
          createdBy: testUserId,
          title: 'Usage Test Template',
          contentEn: 'Test content',
          category: 'greeting',
          variables: [],
          isActive: true,
          usageCount: 0,
        },
      });
      templateId = template.id;
    });

    it('should increment usage count when template is used', async () => {
      const before = await prisma.messageTemplate.findUnique({
        where: { id: templateId },
      });
      expect(before?.usageCount).toBe(0);

      // Simulate template usage
      await prisma.messageTemplate.update({
        where: { id: templateId },
        data: {
          usageCount: { increment: 1 },
        },
      });

      const after = await prisma.messageTemplate.findUnique({
        where: { id: templateId },
      });
      expect(after?.usageCount).toBe(1);
    });

    it('should track multiple uses correctly', async () => {
      // Use template 5 times
      for (let i = 0; i < 5; i++) {
        await prisma.messageTemplate.update({
          where: { id: templateId },
          data: {
            usageCount: { increment: 1 },
          },
        });
      }

      const template = await prisma.messageTemplate.findUnique({
        where: { id: templateId },
      });
      expect(template?.usageCount).toBe(5);
    });
  });

  describe('Step 6: Analytics verification', () => {
    beforeEach(async () => {
      // Create templates with different usage counts
      await prisma.messageTemplate.createMany({
        data: [
          {
            orgId: testOrgId,
            title: 'Most Used',
            contentEn: 'Popular template',
            category: 'greeting',
            variables: [],
            isActive: true,
            usageCount: 50,
          },
          {
            orgId: testOrgId,
            title: 'Moderately Used',
            contentEn: 'Sometimes used',
            category: 'troubleshooting',
            variables: [],
            isActive: true,
            usageCount: 20,
          },
          {
            orgId: testOrgId,
            title: 'Rarely Used',
            contentEn: 'Seldom used',
            category: 'closing',
            variables: [],
            isActive: true,
            usageCount: 3,
          },
          {
            orgId: testOrgId,
            title: 'Never Used',
            contentEn: 'Not used yet',
            category: 'product_info',
            variables: [],
            isActive: true,
            usageCount: 0,
          },
        ],
      });
    });

    it('should get total template count', async () => {
      const totalTemplates = await prisma.messageTemplate.count({
        where: { orgId: testOrgId },
      });

      expect(totalTemplates).toBe(4);
    });

    it('should get active vs inactive template counts', async () => {
      const activeCount = await prisma.messageTemplate.count({
        where: { orgId: testOrgId, isActive: true },
      });

      expect(activeCount).toBe(4);
    });

    it('should get active template count', async () => {
      const activeCount = await prisma.messageTemplate.count({
        where: { orgId: testOrgId, isActive: true },
      });

      expect(activeCount).toBe(4);
    });

    it('should get most used templates (top 5)', async () => {
      const mostUsed = await prisma.messageTemplate.findMany({
        where: { orgId: testOrgId },
        orderBy: { usageCount: 'desc' },
        take: 5,
      });

      expect(mostUsed).toHaveLength(4);
      expect(mostUsed[0].title).toBe('Most Used');
      expect(mostUsed[0].usageCount).toBe(50);
      expect(mostUsed[1].title).toBe('Moderately Used');
      expect(mostUsed[1].usageCount).toBe(20);
    });

    it('should get category statistics', async () => {
      const categoryStats = await prisma.messageTemplate.groupBy({
        by: ['category'],
        where: { orgId: testOrgId },
        _count: { category: true },
      });

      expect(categoryStats).toHaveLength(4);
      expect(categoryStats.find((c) => c.category === 'greeting')?._count.category).toBe(1);
      expect(categoryStats.find((c) => c.category === 'troubleshooting')?._count.category).toBe(
        1
      );
    });

    it('should calculate total usage across all templates', async () => {
      const result = await prisma.messageTemplate.aggregate({
        where: { orgId: testOrgId },
        _sum: { usageCount: true },
      });

      expect(result._sum.usageCount).toBe(73); // 50 + 20 + 3 + 0
    });

    it('should get average usage count', async () => {
      const result = await prisma.messageTemplate.aggregate({
        where: { orgId: testOrgId },
        _avg: { usageCount: true },
      });

      expect(result._avg.usageCount).toBe(18.25); // (50 + 20 + 3 + 0) / 4
    });
  });

  describe('Complete E2E Flow', () => {
    it('should complete the full template lifecycle', async () => {
      // Step 1: Create bilingual template
      const template = await prisma.messageTemplate.create({
        data: {
          orgId: testOrgId,
          createdBy: testUserId,
          title: 'E2E Test Template',
          contentEn: 'Hello {{customer_name}}, order {{order_number}} update',
          contentAr: 'مرحباً {{customer_name}}، تحديث طلب {{order_number}}',
          category: 'product_info',
          shortcut: '/e2e',
          variables: ['customer_name', 'order_number'],
          isActive: true,
          usageCount: 0,
        },
      });

      // Verify creation
      expect(template.id).toBeDefined();
      expect(template.usageCount).toBe(0);

      // Step 2: Simulate opening conversation and pressing /
      const fetchedTemplates = await prisma.messageTemplate.findMany({
        where: {
          orgId: testOrgId,
          isActive: true,
        },
      });

      expect(fetchedTemplates.length).toBeGreaterThan(0);
      expect(fetchedTemplates.find((t) => t.id === template.id)).toBeDefined();

      // Step 3: Simulate AI suggestions (would be called with conversation context)
      // In real usage, this would analyze the conversation and suggest relevant templates
      const suggestedTemplate = fetchedTemplates[0]!;

      // Step 4: Interpolate variables
      const service = new TemplateInterpolationService();
      const interpolated = service.interpolateBilingual(
        {
          content: suggestedTemplate.contentEn,
          contentAr: suggestedTemplate.contentAr || '',
        },
        {
          customer_name: 'Ahmed Hassan',
          order_number: '#E2E-12345',
        }
      );

      expect(interpolated.content).toBe(
        'Hello Ahmed Hassan, order #E2E-12345 update'
      );
      expect(interpolated.contentAr).toBe(
        'مرحباً Ahmed Hassan، تحديث طلب #E2E-12345'
      );

      // Step 5: Track usage
      await prisma.messageTemplate.update({
        where: { id: template.id },
        data: {
          usageCount: { increment: 1 },
        },
      });

      // Step 6: Verify analytics
      const updatedTemplate = await prisma.messageTemplate.findUnique({
        where: { id: template.id },
      });

      expect(updatedTemplate?.usageCount).toBe(1);

      // Verify it appears in analytics
      const mostUsed = await prisma.messageTemplate.findMany({
        where: { orgId: testOrgId },
        orderBy: { usageCount: 'desc' },
        take: 10,
      });

      expect(mostUsed.find((t) => t.id === template.id)).toBeDefined();
    });

    it('should handle bilingual templates end-to-end', async () => {
      // Create Arabic template
      const arabicTemplate = await prisma.messageTemplate.create({
        data: {
          orgId: testOrgId,
          createdBy: testUserId,
          title: 'رسالة ترحيب',
          contentEn: 'Welcome {{customer_name}}!',
          contentAr: 'مرحباً بك {{customer_name}}!',
          category: 'greeting',
          shortcut: '/welcome-ar',
          variables: ['customer_name'],
          isActive: true,
          usageCount: 0,
        },
      });

      // Interpolate with Arabic name
      const service = new TemplateInterpolationService();
      const result = service.interpolateBilingual(
        {
          content: arabicTemplate.contentEn,
          contentAr: arabicTemplate.contentAr || '',
        },
        { customer_name: 'فاطمة' }
      );

      expect(result.content).toBe('Welcome فاطمة!');
      expect(result.contentAr).toBe('مرحباً بك فاطمة!');

      // Track usage
      await prisma.messageTemplate.update({
        where: { id: arabicTemplate.id },
        data: { usageCount: { increment: 1 } },
      });

      const updated = await prisma.messageTemplate.findUnique({
        where: { id: arabicTemplate.id },
      });

      expect(updated?.usageCount).toBe(1);
    });
  });
});
