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
