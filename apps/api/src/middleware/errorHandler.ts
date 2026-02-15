import type { Request, Response, NextFunction } from 'express';
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

  // Prisma known errors
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as unknown as { code: string; meta?: { target?: string[] } };
    if (prismaErr.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: `Duplicate value for ${prismaErr.meta?.target?.join(', ') || 'field'}`,
        code: 'DUPLICATE',
      });
    }
    if (prismaErr.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Record not found',
        code: 'NOT_FOUND',
      });
    }
  }

  // Unexpected errors
  logger.error({ err }, 'Unhandled error');

  // Fire-and-forget error logging to DB
  errorLogService.log({
    level: 'ERROR',
    message: err.message,
    stack: err.stack,
    source: 'api',
    path: req.path,
    method: req.method,
    userId: (req as any).user?.userId,
    ipAddress: req.ip,
  }).catch(() => {});

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
  });
}
