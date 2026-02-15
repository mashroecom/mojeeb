import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Adds a unique X-Request-ID header to every request/response
 * for distributed tracing and debugging.
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const existing = req.headers['x-request-id'] as string | undefined;
  const id = existing || crypto.randomUUID();

  // Make it available on the request object
  (req as any).requestId = id;

  // Echo it back in the response
  res.setHeader('X-Request-ID', id);

  next();
}
