import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';
import { errorLogService } from '../services/errorLog.service';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }

  // Prisma known errors — use proper instanceof check
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[]) || [];
      return res.status(409).json({
        success: false,
        error: `Duplicate value for ${target.join(', ') || 'field'}`,
        code: 'DUPLICATE',
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Record not found',
        code: 'NOT_FOUND',
      });
    }
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      error: 'Invalid database query',
      code: 'VALIDATION_ERROR',
    });
  }

  // Body-parser errors (malformed JSON, payload too large, ...) are client errors,
  // not server faults: they carry the HTTP status to answer with.
  const bodyError = err as Error & { type?: string; status?: number; statusCode?: number };
  const bodyStatus = bodyError.status ?? bodyError.statusCode;
  if (typeof bodyError.type === 'string' && bodyStatus && bodyStatus >= 400 && bodyStatus < 500) {
    const isTooLarge = bodyError.type === 'entity.too.large';
    return res.status(bodyStatus).json({
      success: false,
      error: isTooLarge ? 'Request body is too large' : 'Malformed request body',
      code: isTooLarge ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
    });
  }

  // Unexpected errors
  logger.error({ err }, 'Unhandled error');

  // Fire-and-forget error logging to DB
  errorLogService
    .log({
      level: 'ERROR',
      message: err.message,
      stack: err.stack,
      source: 'api',
      path: req.path,
      method: req.method,
      userId: (req as any).user?.userId,
      ipAddress: req.ip,
    })
    .catch(() => {});

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
  });
}
