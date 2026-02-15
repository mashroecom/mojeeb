import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validate } from './validate';

// ---------------------------------------------------------------------------
// Helpers to create mock Express req / res / next
// ---------------------------------------------------------------------------

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validate middleware', () => {
  // -----------------------------------------------------------------------
  // Body validation
  // -----------------------------------------------------------------------
  describe('body validation', () => {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
    });

    it('should call next() when the body is valid', () => {
      const req = mockReq({ body: { name: 'John', email: 'john@example.com' } });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: schema })(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should replace req.body with parsed data (stripping extra fields)', () => {
      const req = mockReq({
        body: { name: 'John', email: 'john@example.com', extra: 'removed' },
      });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: schema })(req, res, next);

      expect(req.body).toEqual({ name: 'John', email: 'john@example.com' });
      expect(req.body.extra).toBeUndefined();
    });

    it('should return 400 when the body is invalid', () => {
      const req = mockReq({ body: { name: '', email: 'not-an-email' } });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: schema })(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
          details: expect.objectContaining({
            body: expect.any(Object),
          }),
        }),
      );
    });

    it('should return 400 when the body is missing required fields', () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: schema })(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // -----------------------------------------------------------------------
  // Query validation
  // -----------------------------------------------------------------------
  describe('query validation', () => {
    const querySchema = z.object({
      page: z.coerce.number().int().positive(),
      limit: z.coerce.number().int().positive().max(100),
    });

    it('should call next() when the query is valid', () => {
      const req = mockReq({ query: { page: '1', limit: '10' } });
      const res = mockRes();
      const next = vi.fn();

      validate({ query: querySchema })(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should set validatedQuery on the request when valid', () => {
      const req = mockReq({ query: { page: '2', limit: '25' } });
      const res = mockRes();
      const next = vi.fn();

      validate({ query: querySchema })(req, res, next);

      expect((req as any).validatedQuery).toEqual({ page: 2, limit: 25 });
    });

    it('should return 400 when query is invalid', () => {
      const req = mockReq({ query: { page: '-1', limit: 'abc' } });
      const res = mockRes();
      const next = vi.fn();

      validate({ query: querySchema })(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            query: expect.any(Object),
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Params validation
  // -----------------------------------------------------------------------
  describe('params validation', () => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    it('should call next() when params are valid', () => {
      const req = mockReq({
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      const res = mockRes();
      const next = vi.fn();

      validate({ params: paramsSchema })(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('should set validatedParams on the request when valid', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const req = mockReq({ params: { id: uuid } });
      const res = mockRes();
      const next = vi.fn();

      validate({ params: paramsSchema })(req, res, next);

      expect((req as any).validatedParams).toEqual({ id: uuid });
    });

    it('should return 400 when params are invalid', () => {
      const req = mockReq({ params: { id: 'not-a-uuid' } });
      const res = mockRes();
      const next = vi.fn();

      validate({ params: paramsSchema })(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            params: expect.any(Object),
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Multiple schemas
  // -----------------------------------------------------------------------
  describe('multiple schemas combined', () => {
    const bodySchema = z.object({ name: z.string().min(1) });
    const paramsSchema = z.object({ id: z.string().uuid() });

    it('should validate both body and params together', () => {
      const req = mockReq({
        body: { name: 'Test' },
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: bodySchema, params: paramsSchema })(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('should return errors for all failing schemas', () => {
      const req = mockReq({
        body: {},
        params: { id: 'bad' },
      });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: bodySchema, params: paramsSchema })(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      const jsonCall = res.json.mock.calls[0][0];
      expect(jsonCall.details).toHaveProperty('body');
      expect(jsonCall.details).toHaveProperty('params');
    });
  });

  // -----------------------------------------------------------------------
  // No schemas
  // -----------------------------------------------------------------------
  describe('no schemas', () => {
    it('should call next() when no schemas are provided', () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      validate({})(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });
  });
});
