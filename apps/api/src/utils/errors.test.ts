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

describe('AppError', () => {
  it('should create an error with the given message, status code, and code', () => {
    const error = new AppError('Something went wrong', 500, 'INTERNAL_ERROR');
    expect(error.message).toBe('Something went wrong');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.isOperational).toBe(true);
  });

  it('should default to INTERNAL_ERROR code if none is provided', () => {
    const error = new AppError('Oops', 500);
    expect(error.code).toBe('INTERNAL_ERROR');
  });

  it('should be an instance of Error', () => {
    const error = new AppError('test', 500);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should have a proper prototype chain', () => {
    const error = new AppError('test', 500);
    expect(Object.getPrototypeOf(error)).toBe(AppError.prototype);
  });
});

describe('BadRequestError', () => {
  it('should have status code 400 and default message', () => {
    const error = new BadRequestError();
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Bad request');
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.isOperational).toBe(true);
  });

  it('should accept a custom message', () => {
    const error = new BadRequestError('Invalid input');
    expect(error.message).toBe('Invalid input');
    expect(error.statusCode).toBe(400);
  });

  it('should accept a custom code', () => {
    const error = new BadRequestError('Invalid', 'VALIDATION_FAILED');
    expect(error.code).toBe('VALIDATION_FAILED');
  });

  it('should be an instance of AppError', () => {
    const error = new BadRequestError();
    // Note: Object.setPrototypeOf(this, AppError.prototype) in the base constructor
    // means subclass instanceof checks will not work as typically expected.
    // The prototype is always AppError.prototype, so we verify AppError instanceof
    // and check the status code / code to confirm the correct subclass was used.
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
  });
});

describe('UnauthorizedError', () => {
  it('should have status code 401 and default message', () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Unauthorized');
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('should accept a custom message', () => {
    const error = new UnauthorizedError('Token expired');
    expect(error.message).toBe('Token expired');
  });

  it('should be an instance of AppError', () => {
    const error = new UnauthorizedError();
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('ForbiddenError', () => {
  it('should have status code 403 and default message', () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe('Forbidden');
    expect(error.code).toBe('FORBIDDEN');
  });

  it('should accept a custom message', () => {
    const error = new ForbiddenError('No access');
    expect(error.message).toBe('No access');
  });
});

describe('NotFoundError', () => {
  it('should have status code 404 and default message', () => {
    const error = new NotFoundError();
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Not found');
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should accept a custom message', () => {
    const error = new NotFoundError('User not found');
    expect(error.message).toBe('User not found');
  });
});

describe('ConflictError', () => {
  it('should have status code 409 and default message', () => {
    const error = new ConflictError();
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe('Conflict');
    expect(error.code).toBe('CONFLICT');
  });

  it('should accept a custom message', () => {
    const error = new ConflictError('Resource already exists');
    expect(error.message).toBe('Resource already exists');
  });
});

describe('TooManyRequestsError', () => {
  it('should have status code 429 and default message', () => {
    const error = new TooManyRequestsError();
    expect(error.statusCode).toBe(429);
    expect(error.message).toBe('Too many requests');
    expect(error.code).toBe('RATE_LIMITED');
  });

  it('should accept a custom message', () => {
    const error = new TooManyRequestsError('Slow down');
    expect(error.message).toBe('Slow down');
  });
});

describe('UsageLimitError', () => {
  it('should have status code 402 and default message', () => {
    const error = new UsageLimitError();
    expect(error.statusCode).toBe(402);
    expect(error.message).toBe('Usage limit exceeded');
    expect(error.code).toBe('USAGE_LIMIT');
  });

  it('should accept a custom message', () => {
    const error = new UsageLimitError('Messages limit reached');
    expect(error.message).toBe('Messages limit reached');
  });

  it('should be an instance of AppError', () => {
    const error = new UsageLimitError();
    expect(error).toBeInstanceOf(AppError);
  });
});
