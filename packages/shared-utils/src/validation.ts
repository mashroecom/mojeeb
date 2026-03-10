import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

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
