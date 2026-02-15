import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requestId } from './requestId';

function createMockReqRes(headers: Record<string, string> = {}) {
  const req = {
    headers: { ...headers },
  } as unknown as Request;

  const resHeaders: Record<string, string> = {};
  const res = {
    setHeader: vi.fn((key: string, value: string) => {
      resHeaders[key] = value;
    }),
    getHeader: (key: string) => resHeaders[key],
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next, resHeaders };
}

describe('requestId middleware', () => {
  it('generates a UUID when no X-Request-ID header exists', () => {
    const { req, res, next } = createMockReqRes();

    requestId(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).requestId).toBeDefined();
    expect((req as any).requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', (req as any).requestId);
  });

  it('reuses existing X-Request-ID header', () => {
    const existingId = 'existing-request-id-123';
    const { req, res, next } = createMockReqRes({ 'x-request-id': existingId });

    requestId(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).requestId).toBe(existingId);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', existingId);
  });

  it('generates unique IDs for different requests', () => {
    const mock1 = createMockReqRes();
    const mock2 = createMockReqRes();

    requestId(mock1.req, mock1.res, mock1.next);
    requestId(mock2.req, mock2.res, mock2.next);

    expect((mock1.req as any).requestId).not.toBe((mock2.req as any).requestId);
  });

  it('always calls next()', () => {
    const { req, res, next } = createMockReqRes();

    requestId(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
