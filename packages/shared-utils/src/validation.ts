import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// ---------------------------------------------------------------------------
// Configurable password policy
// ---------------------------------------------------------------------------

/**
 * The platform password policy. Administrators configure it in the admin panel
 * (Settings → Security); the API enforces it whenever a password is set or changed.
 * A lowercase letter is always required — it is not configurable.
 */
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

/** The policy applied when nothing is configured — identical to `passwordSchema`. */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
};

/** Hard upper bound on password length (keeps hashing cost bounded). */
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRule =
  | 'minLength'
  | 'maxLength'
  | 'uppercase'
  | 'lowercase'
  | 'number'
  | 'special';

/** Rules a password has to satisfy under `policy`, in display order. */
export function passwordPolicyRules(
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): PasswordRule[] {
  const rules: PasswordRule[] = ['minLength'];
  if (policy.requireUppercase) rules.push('uppercase');
  rules.push('lowercase');
  if (policy.requireNumbers) rules.push('number');
  if (policy.requireSpecialChars) rules.push('special');
  return rules;
}

/** Returns the rules `password` violates under `policy` (empty array = acceptable). */
export function checkPasswordPolicy(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): PasswordRule[] {
  const failed: PasswordRule[] = [];
  if (password.length < policy.minLength) failed.push('minLength');
  if (password.length > PASSWORD_MAX_LENGTH) failed.push('maxLength');
  if (policy.requireUppercase && !/[A-Z]/.test(password)) failed.push('uppercase');
  if (!/[a-z]/.test(password)) failed.push('lowercase');
  if (policy.requireNumbers && !/[0-9]/.test(password)) failed.push('number');
  if (policy.requireSpecialChars && !/[^A-Za-z0-9\s]/.test(password)) failed.push('special');
  return failed;
}

/** English message for a violated rule (same wording as `passwordSchema`). */
export function passwordRuleMessage(
  rule: PasswordRule,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): string {
  switch (rule) {
    case 'minLength':
      return `Password must be at least ${policy.minLength} characters`;
    case 'maxLength':
      return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
    case 'uppercase':
      return 'Password must contain at least one uppercase letter';
    case 'lowercase':
      return 'Password must contain at least one lowercase letter';
    case 'number':
      return 'Password must contain at least one number';
    case 'special':
      return 'Password must contain at least one special character';
  }
}

/**
 * Zod schema enforcing `policy`. `messages` lets a UI supply translated texts;
 * rules without a custom message fall back to the English ones.
 */
export function buildPasswordSchema(
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
  messages: Partial<Record<PasswordRule, string>> = {},
) {
  return z.string().superRefine((value, ctx) => {
    for (const rule of checkPasswordPolicy(value, policy)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: messages[rule] ?? passwordRuleMessage(rule, policy),
      });
    }
  });
}

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  organizationName: z.string().min(2, 'Organization name is required').max(100),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  aiProvider: z.enum(['OPENAI', 'ANTHROPIC']).optional().default('OPENAI'),
  aiModel: z.string().min(1).optional().default('gpt-4o'),
  systemPrompt: z.string().min(10).max(10000).optional(),
  templateType: z.string().max(50).optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().int().min(100).max(8192).optional().default(1024),
  language: z.enum(['ar', 'en']).optional().default('ar'),
  enableEmotionDetection: z.boolean().optional().default(true),
  enableLeadExtraction: z.boolean().optional().default(false),
  enableHumanHandoff: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
  handoffThreshold: z.number().min(0).max(1).optional().default(0.3),
  // AI Behavior
  tone: z.enum(['friendly', 'professional', 'casual', 'empathetic']).optional().default('friendly'),
  responseLength: z.enum(['short', 'medium', 'detailed']).optional().default('medium'),
  // Data Collection
  dataCollectionConfig: z
    .object({
      requiredFields: z
        .array(z.enum(['name', 'email', 'phone', 'company', 'address', 'orderNumber']))
        .optional()
        .default([]),
      collectionStrategy: z.enum(['natural', 'upfront', 'end']).optional().default('natural'),
      customFields: z
        .array(
          z.object({
            name: z.string().min(1).max(50),
            type: z.enum(['text', 'number', 'email', 'phone']),
            label: z.string().min(1).max(100),
            labelAr: z.string().max(100).optional().default(''),
          }),
        )
        .optional()
        .default([]),
      confirmationEnabled: z.boolean().optional().default(true),
    })
    .optional(),
  // Escalation
  escalationKeywords: z.array(z.string().max(100)).max(20).optional().default([]),
  sentimentEscalation: z.boolean().optional().default(false),
  escalationMessageCount: z.number().int().min(2).max(20).optional().default(5),
  // Quick Replies
  quickRepliesConfig: z
    .object({
      enabled: z.boolean().optional().default(false),
      maxButtons: z.number().int().min(2).max(5).optional().default(3),
      aiSuggestions: z.boolean().optional().default(true),
      predefinedSets: z
        .array(
          z.object({
            trigger: z.enum(['greeting', 'faq', 'closing', 'custom']),
            buttons: z
              .array(
                z.object({
                  text: z.string().min(1).max(40),
                  textAr: z.string().max(40).optional().default(''),
                }),
              )
              .max(5),
          }),
        )
        .optional()
        .default([]),
    })
    .optional(),
});

export const connectChannelSchema = z.object({
  type: z.enum(['WHATSAPP', 'MESSENGER', 'INSTAGRAM', 'WEBCHAT']),
  name: z.string().min(1).max(100),
  credentials: z.record(z.string()),
  externalId: z.string().optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  contentType: z.enum(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT']).optional().default('TEXT'),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const orgIdParamSchema = z.object({
  orgId: z.string().min(1),
});
