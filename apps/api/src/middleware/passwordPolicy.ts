import type { Request, Response, NextFunction } from 'express';
import { checkPasswordPolicy, passwordRuleMessage } from '@mojeeb/shared-utils';
import { systemSettings } from '../services/systemSettings.service';

/**
 * Enforces the admin-configured password policy (Settings → Security) on the request
 * body field that carries a NEW password. Mount it after `validate()` on every route
 * that sets or changes a password — the policy applies when a password is chosen, never
 * at login, so tightening it does not lock existing users out.
 *
 * Rejections use the same shape as `validate()` so clients can show them per field.
 * The password itself is never logged or echoed.
 */
export function enforcePasswordPolicy(field: string = 'password') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const value: unknown = req.body?.[field];
      // Absent/empty optional password fields are the route schema's business.
      if (value === undefined || value === null || value === '') return next();
      if (typeof value !== 'string') return next();

      const policy = await systemSettings.passwordPolicy();
      const failed = checkPasswordPolicy(value, policy);
      if (failed.length === 0) return next();

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: {
          body: {
            formErrors: [],
            fieldErrors: { [field]: failed.map((rule) => passwordRuleMessage(rule, policy)) },
          },
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
