import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler } from './errorHandler';
import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError } from '../utils/errors';

// Mock dependencies
vi.mock('../config/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../services/errorLog.service', () => ({
  errorLogService: { log: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    meta?: Record<string, unknown>;
    constructor(message: string, opts: { code: string; meta?: Record<string, unknown>; clientVersion: string }) {
      super(message);
      this.name = 'PrismaClientKnownRequestError';
      this.code = opts.code;
      this.meta = opts.meta;
    }
  }
  class PrismaClientValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PrismaClientValidationError';
    }
  }
  return {
    Prisma: {
      PrismaClientKnownRequestError,
      PrismaClientValidationError,
    },
  };
});

function createMockReqRes() {
  const req = {
    path: '/test',
    method: 'GET',
    ip: '127.0.0.1',
    user: undefined,
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  it('handles BadRequestError (400)', () => {
    const { req, res, next } = createMockReqRes();
    const err = new BadRequestError('Invalid input');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid input',
      code: 'BAD_REQUEST',
    });
  });

  it('handles UnauthorizedError (401)', () => {
    const { req, res, next } = createMockReqRes();
    const err = new UnauthorizedError('Not authenticated');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Not authenticated',
      code: 'UNAUTHORIZED',
    });
  });

  it('handles ForbiddenError (403)', () => {
    const { req, res, next } = createMockReqRes();
    const err = new ForbiddenError('Access denied');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Access denied',
      code: 'FORBIDDEN',
    });
  });

  it('handles NotFoundError (404)', () => {
    const { req, res, next } = createMockReqRes();
    const err = new NotFoundError('Resource not found');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Resource not found',
      code: 'NOT_FOUND',
    });
  });

  it('handles custom AppError with arbitrary status', () => {
    const { req, res, next } = createMockReqRes();
    const err = new AppError('Conflict', 409, 'CONFLICT');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Conflict',
      code: 'CONFLICT',
    });
  });

  it('handles Prisma P2002 duplicate error', async () => {
    const { req, res, next } = createMockReqRes();
    const { Prisma } = await import('@prisma/client');
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      meta: { target: ['email'] },
      clientVersion: '5.0.0',
    });

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Duplicate value for email',
      code: 'DUPLICATE',
    });
  });

  it('handles Prisma P2025 not found error', async () => {
    const { req, res, next } = createMockReqRes();
    const { Prisma } = await import('@prisma/client');
    const err = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Record not found',
      code: 'NOT_FOUND',
    });
  });

  it('handles Prisma validation error', async () => {
    const { req, res, next } = createMockReqRes();
    const { Prisma } = await import('@prisma/client');
    const err = new Prisma.PrismaClientValidationError('Bad query', { clientVersion: '5.0.0' });

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid database query',
      code: 'VALIDATION_ERROR',
    });
  });

  it('handles unknown errors with 500', () => {
    const { req, res, next } = createMockReqRes();
    const err = new Error('Something broke');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'INTERNAL_ERROR',
      }),
    );
  });

  it('hides error details in production', () => {
    const { req, res, next } = createMockReqRes();
    process.env.NODE_ENV = 'production';
    const err = new Error('Sensitive database details');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  });

  it('shows error details in non-production', () => {
    const { req, res, next } = createMockReqRes();
    process.env.NODE_ENV = 'test';
    const err = new Error('Debug info here');

    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Debug info here',
      code: 'INTERNAL_ERROR',
    });
  });
});
