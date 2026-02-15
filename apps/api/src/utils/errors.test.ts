import { describe, it, expect } from 'vitest';
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  UsageLimitError,
} from './errors';

// ---------------------------------------------------------------------------
// AppError (base class)
// ---------------------------------------------------------------------------

describe('AppError', () => {
  it('should create an error with the given message, statusCode, and code', () => {
    const error = new AppError('Something went wrong', 500, 'INTERNAL_ERROR');
    expect(error.message).toBe('Something went wrong');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.isOperational).toBe(true);
  });

  it('should default code to INTERNAL_ERROR when not provided', () => {
    const error = new AppError('Oops', 500);
    expect(error.code).toBe('INTERNAL_ERROR');
  });

  it('should be an instance of Error', () => {
    const error = new AppError('test', 500);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should have a proper prototype chain via Object.setPrototypeOf', () => {
    const error = new AppError('test', 500);
    expect(Object.getPrototypeOf(error)).toBe(AppError.prototype);
  });

  it('should allow arbitrary status codes', () => {
    const error = new AppError('custom', 418, 'IM_A_TEAPOT');
    expect(error.statusCode).toBe(418);
    expect(error.code).toBe('IM_A_TEAPOT');
  });
});

// ---------------------------------------------------------------------------
// BadRequestError
// ---------------------------------------------------------------------------

describe('BadRequestError', () => {
  it('should have statusCode 400 and code BAD_REQUEST', () => {
    const error = new BadRequestError();
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Bad request');
    expect(error.isOperational).toBe(true);
  });

  it('should accept a custom message', () => {
    const error = new BadRequestError('Invalid input');
    expect(error.message).toBe('Invalid input');
    expect(error.statusCode).toBe(400);
  });

  it('should accept a custom code', () => {
    const error = new BadRequestError('Validation failed', 'VALIDATION_FAILED');
    expect(error.code).toBe('VALIDATION_FAILED');
  });

  it('should be an instance of AppError', () => {
    const error = new BadRequestError();
    expect(error).toBeInstanceOf(AppError);
  });
});

// ---------------------------------------------------------------------------
// UnauthorizedError
// ---------------------------------------------------------------------------

describe('UnauthorizedError', () => {
  it('should have statusCode 401 and code UNAUTHORIZED', () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Unauthorized');
    expect(error.isOperational).toBe(true);
  });

  it('should accept a custom message', () => {
    const error = new UnauthorizedError('Token expired');
    expect(error.message).toBe('Token expired');
    expect(error.statusCode).toBe(401);
  });

  it('should be an instance of AppError', () => {
    const error = new UnauthorizedError();
    expect(error).toBeInstanceOf(AppError);
  });
});

// ---------------------------------------------------------------------------
// ForbiddenError
// ---------------------------------------------------------------------------

describe('ForbiddenError', () => {
  it('should have statusCode 403 and code FORBIDDEN', () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Forbidden');
    expect(error.isOperational).toBe(true);
  });

  it('should accept a custom message', () => {
    const error = new ForbiddenError('No access');
    expect(error.message).toBe('No access');
    expect(error.statusCode).toBe(403);
  });

  it('should be an instance of AppError', () => {
    const error = new ForbiddenError();
    expect(error).toBeInstanceOf(AppError);
  });
});

// ---------------------------------------------------------------------------
// NotFoundError
// ---------------------------------------------------------------------------

describe('NotFoundError', () => {
  it('should have statusCode 404 and code NOT_FOUND', () => {
    const error = new NotFoundError();
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Not found');
    expect(error.isOperational).toBe(true);
  });

  it('should accept a custom message', () => {
    const error = new NotFoundError('User not found');
    expect(error.message).toBe('User not found');
    expect(error.statusCode).toBe(404);
  });

  it('should be an instance of AppError', () => {
    const error = new NotFoundError();
    expect(error).toBeInstanceOf(AppError);
  });
});

// ---------------------------------------------------------------------------
// ConflictError
// ---------------------------------------------------------------------------

describe('ConflictError', () => {
  it('should have statusCode 409 and code CONFLICT', () => {
    const error = new ConflictError();
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toBe('Conflict');
    expect(error.isOperational).toBe(true);
  });

  it('should accept a custom message', () => {
    const error = new ConflictError('Resource already exists');
    expect(error.message).toBe('Resource already exists');
    expect(error.statusCode).toBe(409);
  });

  it('should be an instance of AppError', () => {
    const error = new ConflictError();
    expect(error).toBeInstanceOf(AppError);
  });
});

// ---------------------------------------------------------------------------
// TooManyRequestsError
// ---------------------------------------------------------------------------

describe('TooManyRequestsError', () => {
  it('should have statusCode 429 and code RATE_LIMITED', () => {
    const error = new TooManyRequestsError();
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.message).toBe('Too many requests');
    expect(error.isOperational).toBe(true);
  });

  it('should accept a custom message', () => {
    const error = new TooManyRequestsError('Slow down');
    expect(error.message).toBe('Slow down');
    expect(error.statusCode).toBe(429);
  });

  it('should be an instance of AppError', () => {
    const error = new TooManyRequestsError();
    expect(error).toBeInstanceOf(AppError);
  });
});

// ---------------------------------------------------------------------------
// UsageLimitError
// ---------------------------------------------------------------------------

describe('UsageLimitError', () => {
  it('should have statusCode 402 and code USAGE_LIMIT', () => {
    const error = new UsageLimitError();
    expect(error.statusCode).toBe(402);
    expect(error.code).toBe('USAGE_LIMIT');
    expect(error.message).toBe('Usage limit exceeded');
    expect(error.isOperational).toBe(true);
  });

  it('should accept a custom message', () => {
    const error = new UsageLimitError('Messages limit reached');
    expect(error.message).toBe('Messages limit reached');
    expect(error.statusCode).toBe(402);
  });

  it('should be an instance of AppError', () => {
    const error = new UsageLimitError();
    expect(error).toBeInstanceOf(AppError);
  });
});
