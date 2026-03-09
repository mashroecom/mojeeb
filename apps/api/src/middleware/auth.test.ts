import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, requireRole } from './auth';

const JWT_SECRET = 'test-secret-at-least-32-characters-long';

// Mock dependencies
vi.mock('../config', () => ({
  config: { jwt: { secret: 'test-secret-at-least-32-characters-long' } },
}));
vi.mock('../config/database', () => ({
  prisma: { orgMembership: { findUnique: vi.fn() } },
}));
vi.mock('../services/tokenBlacklist.service', () => ({
  tokenBlacklistService: { isBlacklisted: vi.fn().mockResolvedValue(false) },
}));

function createMockReqRes(headers: Record<string, string> = {}) {
  const req = {
    headers: { ...headers },
    params: {},
    user: undefined,
    org: undefined,
  } as unknown as Request;

  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
}

/** Helper: extract the error passed to next() */
function getNextError(next: NextFunction): any {
  const mockNext = next as unknown as ReturnType<typeof vi.fn>;
  expect(mockNext).toHaveBeenCalledTimes(1);
  return mockNext.mock.calls[0]?.[0];
}

describe('authenticate middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without Authorization header', async () => {
    const { req, res, next } = createMockReqRes();
    await authenticate(req, res, next);

    const err = getNextError(next);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Missing or invalid authorization header');
  });

  it('rejects requests with non-Bearer token', async () => {
    const { req, res, next } = createMockReqRes({ authorization: 'Basic abc123' });
    await authenticate(req, res, next);

    const err = getNextError(next);
    expect(err.statusCode).toBe(401);
  });

  it('rejects invalid JWT tokens', async () => {
    const { req, res, next } = createMockReqRes({ authorization: 'Bearer invalid.token.here' });
    await authenticate(req, res, next);

    const err = getNextError(next);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Invalid token');
  });

  it('rejects expired tokens', async () => {
    const token = jwt.sign({ userId: '1', email: 'test@test.com' }, JWT_SECRET, { expiresIn: '-1s' });
    const { req, res, next } = createMockReqRes({ authorization: `Bearer ${token}` });
    await authenticate(req, res, next);

    const err = getNextError(next);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Token expired');
    expect(err.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects tokens signed with wrong secret', async () => {
    const token = jwt.sign({ userId: '1', email: 'test@test.com' }, 'wrong-secret');
    const { req, res, next } = createMockReqRes({ authorization: `Bearer ${token}` });
    await authenticate(req, res, next);

    const err = getNextError(next);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Invalid token');
  });

  it('accepts valid tokens and sets req.user', async () => {
    const token = jwt.sign({ userId: 'user123', email: 'test@test.com' }, JWT_SECRET);
    const { req, res, next } = createMockReqRes({ authorization: `Bearer ${token}` });
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe('user123');
    expect(req.user!.email).toBe('test@test.com');
  });

  it('rejects blacklisted tokens', async () => {
    const { tokenBlacklistService } = await import('../services/tokenBlacklist.service');
    vi.mocked(tokenBlacklistService.isBlacklisted).mockResolvedValueOnce(true);

    const token = jwt.sign({ userId: 'user123', email: 'test@test.com', jti: 'blacklisted-jti' }, JWT_SECRET);
    const { req, res, next } = createMockReqRes({ authorization: `Bearer ${token}` });
    await authenticate(req, res, next);

    const err = getNextError(next);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Token has been revoked');
  });
});

describe('requireRole middleware', () => {
  it('rejects when no org context', () => {
    const { req, res, next } = createMockReqRes();
    const middleware = requireRole('OWNER', 'ADMIN');
    middleware(req, res, next);

    const err = getNextError(next);
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Organization context required');
  });

  it('rejects when role is not in allowed list', () => {
    const { req, res, next } = createMockReqRes();
    req.org = { id: 'org1', role: 'MEMBER' };
    const middleware = requireRole('OWNER', 'ADMIN');
    middleware(req, res, next);

    const err = getNextError(next);
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Insufficient permissions');
  });

  it('allows when role matches', () => {
    const { req, res, next } = createMockReqRes();
    req.org = { id: 'org1', role: 'ADMIN' };
    const middleware = requireRole('OWNER', 'ADMIN');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows OWNER role', () => {
    const { req, res, next } = createMockReqRes();
    req.org = { id: 'org1', role: 'OWNER' };
    const middleware = requireRole('OWNER');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
