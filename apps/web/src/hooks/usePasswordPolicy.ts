'use client';

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  DEFAULT_PASSWORD_POLICY,
  PASSWORD_MAX_LENGTH,
  checkPasswordPolicy,
  passwordPolicyRules,
  type PasswordPolicy,
  type PasswordRule,
} from '@mojeeb/shared-utils';
import { api } from '@/lib/api';

/**
 * The platform password policy as configured by the administrators (admin panel →
 * Settings → Security), with translated texts for forms that set a password.
 *
 * Until the policy has loaded (or if the request fails) the built-in default is used;
 * the API enforces the real policy either way, so this only affects the hint shown.
 */
export function usePasswordPolicy() {
  const t = useTranslations('auth.passwordPolicy');

  const { data } = useQuery({
    queryKey: ['public', 'password-policy'],
    queryFn: async (): Promise<PasswordPolicy> => {
      const res = await api.get('/public/password-policy');
      return res.data.data;
    },
    staleTime: 60_000,
    retry: 1,
  });
  const policy: PasswordPolicy = data ?? DEFAULT_PASSWORD_POLICY;

  /** Translated requirement per rule, e.g. "at least 12 characters". */
  const ruleTexts = useMemo<Record<PasswordRule, string>>(
    () => ({
      minLength: t('minLength', { count: policy.minLength }),
      maxLength: t('maxLength', { count: PASSWORD_MAX_LENGTH }),
      uppercase: t('uppercase'),
      lowercase: t('lowercase'),
      number: t('number'),
      special: t('special'),
    }),
    [t, policy.minLength],
  );

  /** Translated full-sentence error per rule, for use as Zod messages. */
  const messages = useMemo(() => {
    const out = {} as Record<PasswordRule, string>;
    for (const rule of Object.keys(ruleTexts) as PasswordRule[]) {
      out[rule] = t('error', { rule: ruleTexts[rule] });
    }
    return out;
  }, [t, ruleTexts]);

  /** One sentence listing everything a new password needs. */
  const hint = useMemo(
    () =>
      t('hint', {
        rules: passwordPolicyRules(policy)
          .map((rule) => ruleTexts[rule])
          .join(t('separator')),
      }),
    [t, policy, ruleTexts],
  );

  /** First problem with `password` as a translated sentence, or null when it is acceptable. */
  const validate = useCallback(
    (password: string): string | null => {
      const failed = checkPasswordPolicy(password, policy)[0];
      return failed ? messages[failed] : null;
    },
    [policy, messages],
  );

  return { policy, hint, messages, validate };
}
