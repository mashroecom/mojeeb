import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export async function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { isSuperAdmin: true, suspendedAt: true },
    });

    if (!user || !user.isSuperAdmin) {
      throw new ForbiddenError('Super admin access required');
    }

    if (user.suspendedAt) {
      throw new ForbiddenError('Account suspended');
    }

    next();
  } catch (err) {
    next(err);
  }
}
