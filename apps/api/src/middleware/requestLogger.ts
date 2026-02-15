import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  let logged = false;

  const onComplete = () => {
    if (logged) return;
    logged = true;

    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      requestId: (req as any).requestId,
    };

    if (res.statusCode >= 400) {
      logger.warn(logData, 'Request completed with error');
    } else {
      logger.info(logData, 'Request completed');
    }
  };

  // Listen to both 'finish' and 'close' to capture all request completions,
  // including early client disconnects that don't trigger 'finish'.
  res.on('finish', onComplete);
  res.on('close', onComplete);

  next();
}
