import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  DEFAULT_PASSWORD_POLICY,
  buildPasswordSchema,
  checkPasswordPolicy,
  passwordPolicyRules,
  passwordSchema,
  type PasswordPolicy,
} from '@mojeeb/shared-utils';

const mocks = vi.hoisted(() => ({
  policy: {
    minLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
  },
}));

vi.mock('./systemSettings.service', () => ({
  systemSettings: { passwordPolicy: vi.fn(async () => mocks.policy) },
}));

import { enforcePasswordPolicy } from '../middleware/passwordPolicy';

const strict: PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

describe('checkPasswordPolicy', () => {
  it('default policy agrees with the legacy passwordSchema', () => {
    for (const pw of ['Abcdef12', 'abcdef12', 'ABCDEF12', 'Abcdefgh', 'Ab1', 'Abcdefg1!', '']) {
      expect(checkPasswordPolicy(pw).length === 0, pw).toBe(passwordSchema.safeParse(pw).success);
    }
  });

  it('enforces the configured minimum length', () => {
    const policy = { ...DEFAULT_PASSWORD_POLICY, minLength: 12 };
    expect(checkPasswordPolicy('Abcdefghi12', policy)).toEqual(['minLength']); // 11 chars
    expect(checkPasswordPolicy('Abcdefghij12', policy)).toEqual([]); // 12 chars
  });

  it('enforces each character class only when required', () => {
    expect(checkPasswordPolicy('abcdefghijk1', strict)).toEqual(['uppercase', 'special']);
    expect(checkPasswordPolicy('Abcdefghijkl!', strict)).toEqual(['number']);
    expect(checkPasswordPolicy('Abcdefghijk1!', strict)).toEqual([]);

    const relaxed = { ...DEFAULT_PASSWORD_POLICY, requireUppercase: false, requireNumbers: false };
    expect(checkPasswordPolicy('abcdefgh', relaxed)).toEqual([]);
  });

  it('always requires a lowercase letter and never counts whitespace as special', () => {
    expect(checkPasswordPolicy('ABCDEFGH12', DEFAULT_PASSWORD_POLICY)).toEqual(['lowercase']);
    expect(checkPasswordPolicy('Abcdefghijk 1', strict)).toEqual(['special']);
  });

  it('rejects passwords longer than 128 characters', () => {
    expect(checkPasswordPolicy(`Aa1${'x'.repeat(126)}`)).toEqual(['maxLength']);
  });

  it('lists the rules of a policy for display', () => {
    expect(passwordPolicyRules(DEFAULT_PASSWORD_POLICY)).toEqual([
      'minLength',
      'uppercase',
      'lowercase',
      'number',
    ]);
    expect(passwordPolicyRules(strict)).toContain('special');
  });
});

describe('buildPasswordSchema', () => {
  it('reports one issue per violated rule, with overridable messages', () => {
    const result = buildPasswordSchema(strict, { special: 'رمز خاص مطلوب' }).safeParse('abc');
    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((i) => i.message);
    expect(messages).toEqual([
      'Password must be at least 12 characters',
      'Password must contain at least one uppercase letter',
      'Password must contain at least one number',
      'رمز خاص مطلوب',
    ]);
  });
});

describe('enforcePasswordPolicy middleware', () => {
  function run(body: Record<string, unknown>, field?: string) {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
    const next = vi.fn();
    return enforcePasswordPolicy(field)({ body } as Request, res, next).then(() => ({ res, next }));
  }

  beforeEach(() => {
    mocks.policy = { ...DEFAULT_PASSWORD_POLICY };
  });

  it('lets a compliant password through', async () => {
    const { res, next } = await run({ password: 'Abcdef12' });
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('applies the configured policy: 11 chars rejected, 12 accepted at minLength 12', async () => {
    mocks.policy = { ...DEFAULT_PASSWORD_POLICY, minLength: 12 };

    const rejected = await run({ password: 'Abcdefghi12' });
    expect(rejected.next).not.toHaveBeenCalled();
    expect(rejected.res.status).toHaveBeenCalledWith(400);
    expect(rejected.res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: {
        body: {
          formErrors: [],
          fieldErrors: { password: ['Password must be at least 12 characters'] },
        },
      },
    });

    const accepted = await run({ password: 'Abcdefghij12' });
    expect(accepted.next).toHaveBeenCalledWith();
  });

  it('never echoes the rejected password', async () => {
    const { res } = await run({ password: 'short' });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('short');
  });

  it('checks the named field and skips an absent optional one', async () => {
    const weak = await run({ newPassword: 'weak' }, 'newPassword');
    expect(weak.res.status).toHaveBeenCalledWith(400);

    const absent = await run({ firstName: 'Sara' }, 'newPassword');
    expect(absent.next).toHaveBeenCalledWith();
  });
});
