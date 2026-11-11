-- Baseline migration.
--
-- Replaces the earlier migration history, which could not be applied to an empty
-- database (it altered tables that no migration created) and covered only 21 of the
-- 51 models. This file is the full schema as of prisma/schema.prisma.
--
-- Databases that were created with `prisma db push` already contain these objects:
-- mark this migration as applied instead of running it
--   pnpm exec prisma migrate resolve --applied 20260311000000_baseline
-- (scripts/docker-entrypoint.sh does this automatically).

-- pgvector — required by kb_chunks.embedding
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('OPENAI', 'ANTHROPIC');

-- CreateEnum
CREATE TYPE "KBDocumentType" AS ENUM ('TEXT', 'PDF', 'URL', 'FAQ');

-- CreateEnum
CREATE TYPE "EmbeddingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CrawlStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrawlFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'MESSENGER', 'INSTAGRAM', 'WEBCHAT');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'HANDED_OFF', 'WAITING', 'RESOLVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('CUSTOMER', 'AI_AGENT', 'HUMAN_AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageContentType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'LOCATION', 'CONTACT', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('KASHIER', 'STRIPE', 'PAYPAL');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('MESSAGE_RECEIVED', 'MESSAGE_SENT', 'CONVERSATION_STARTED', 'CONVERSATION_RESOLVED', 'HUMAN_HANDOFF', 'LEAD_EXTRACTED', 'EMOTION_DETECTED', 'AI_RESPONSE_GENERATED');

-- CreateEnum
CREATE TYPE "BulkEmailCampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "suspendedAt" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "emailVerifyToken" TEXT,
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "industry" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'ar',
    "primaryColor" TEXT DEFAULT '#6366f1',
    "secondaryColor" TEXT,
    "customCss" TEXT,
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "defaultAiModel" TEXT,
    "defaultAiProvider" TEXT,
    "defaultTemperature" DOUBLE PRECISION,
    "defaultMaxTokens" INTEGER,
    "fallbackMessage" TEXT,
    "fallbackMessageAr" TEXT,
    "escalationThreshold" DOUBLE PRECISION,
    "contactEmail" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "aiProvider" "AiProvider" NOT NULL DEFAULT 'OPENAI',
    "aiModel" TEXT NOT NULL DEFAULT 'gpt-4o',
    "systemPrompt" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 1024,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "enableEmotionDetection" BOOLEAN NOT NULL DEFAULT true,
    "enableLeadExtraction" BOOLEAN NOT NULL DEFAULT false,
    "enableHumanHandoff" BOOLEAN NOT NULL DEFAULT true,
    "handoffThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "tone" TEXT NOT NULL DEFAULT 'friendly',
    "responseLength" TEXT NOT NULL DEFAULT 'medium',
    "dataCollectionConfig" JSONB,
    "escalationKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentimentEscalation" BOOLEAN NOT NULL DEFAULT false,
    "escalationMessageCount" INTEGER NOT NULL DEFAULT 5,
    "quickRepliesConfig" JSONB,
    "templateType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_documents" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "crawlJobId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentType" "KBDocumentType" NOT NULL DEFAULT 'TEXT',
    "sourceUrl" TEXT,
    "metadata" JSONB,
    "embeddingStatus" "EmbeddingStatus" NOT NULL DEFAULT 'PENDING',
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "chunkIndex" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_knowledge_bases" (
    "agentId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,

    CONSTRAINT "agent_knowledge_bases_pkey" PRIMARY KEY ("agentId","knowledgeBaseId")
);

-- CreateTable
CREATE TABLE "crawl_jobs" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "configId" TEXT,
    "startUrl" TEXT NOT NULL,
    "status" "CrawlStatus" NOT NULL DEFAULT 'PENDING',
    "pagesTotal" INTEGER NOT NULL DEFAULT 0,
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawl_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_configs" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "maxDepth" INTEGER NOT NULL DEFAULT 1,
    "urlPattern" TEXT,
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleFrequency" "CrawlFrequency",
    "lastCrawledAt" TIMESTAMP(3),
    "nextCrawlAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawl_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "credentials" JSONB NOT NULL,
    "webhookSecret" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_agents" (
    "channelId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "channel_agents_pkey" PRIMARY KEY ("channelId","agentId")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "agentId" TEXT,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "customerMeta" JSONB,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedToHuman" TEXT,
    "lastEmotion" TEXT,
    "emotionScore" DOUBLE PRECISION,
    "summary" TEXT,
    "category" TEXT,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customerIntent" TEXT,
    "resolutionStatus" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "firstMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "contentType" "MessageContentType" NOT NULL DEFAULT 'TEXT',
    "humanAgentId" TEXT,
    "aiProvider" "AiProvider",
    "aiModel" TEXT,
    "tokenCount" INTEGER,
    "latencyMs" INTEGER,
    "emotion" TEXT,
    "emotionScore" DOUBLE PRECISION,
    "externalId" TEXT,
    "metadata" JSONB,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'SENT',
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_tags" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_ratings" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "conversationId" TEXT,
    "assignedTo" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "interests" TEXT[],
    "budget" TEXT,
    "timeline" TEXT,
    "notes" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "source" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "paymentGateway" "PaymentGateway" NOT NULL DEFAULT 'KASHIER',
    "kashierSubscriptionId" TEXT,
    "kashierCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "paypalSubscriptionId" TEXT,
    "paypalOrderId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "messagesUsed" INTEGER NOT NULL DEFAULT 0,
    "messagesLimit" INTEGER NOT NULL DEFAULT 100,
    "agentsUsed" INTEGER NOT NULL DEFAULT 0,
    "agentsLimit" INTEGER NOT NULL DEFAULT 1,
    "integrationsUsed" INTEGER NOT NULL DEFAULT 0,
    "integrationsLimit" INTEGER NOT NULL DEFAULT 1,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "tokensLimit" INTEGER NOT NULL DEFAULT 500000,
    "aiConversationsUsed" INTEGER NOT NULL DEFAULT 0,
    "aiConversationsLimit" INTEGER NOT NULL DEFAULT 100,
    "spendingCapEnabled" BOOLEAN NOT NULL DEFAULT false,
    "spendingCapAmount" DECIMAL(10,2),
    "overageChargesAccrued" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "paymentGateway" "PaymentGateway" NOT NULL DEFAULT 'KASHIER',
    "kashierOrderId" TEXT,
    "kashierPaymentId" TEXT,
    "stripeInvoiceId" TEXT,
    "stripePaymentIntentId" TEXT,
    "paypalOrderId" TEXT,
    "paypalCaptureId" TEXT,
    "paidAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventType" "AnalyticsEventType" NOT NULL,
    "data" JSONB NOT NULL,
    "channelType" "ChannelType",
    "agentId" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNewConversation" BOOLEAN NOT NULL DEFAULT true,
    "emailHandoff" BOOLEAN NOT NULL DEFAULT true,
    "emailLeadExtracted" BOOLEAN NOT NULL DEFAULT true,
    "emailUsageWarning" BOOLEAN NOT NULL DEFAULT true,
    "emailWeeklyDigest" BOOLEAN NOT NULL DEFAULT false,
    "emailDailyDigest" BOOLEAN NOT NULL DEFAULT false,
    "emailMonthlyReport" BOOLEAN NOT NULL DEFAULT true,
    "emailNegativeSentiment" BOOLEAN NOT NULL DEFAULT true,
    "browserNotifications" BOOLEAN NOT NULL DEFAULT true,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "siteName" TEXT NOT NULL DEFAULT 'Mojeeb',
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "ogImageUrl" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT NOT NULL DEFAULT '',
    "primaryColor" TEXT NOT NULL DEFAULT '#6366f1',
    "secondaryColor" TEXT NOT NULL DEFAULT '#ec4899',
    "twitterUrl" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "youtubeUrl" TEXT,
    "supportEmail" TEXT,
    "contactPhone" TEXT,
    "companyAddress" TEXT,
    "copyrightText" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "googleAnalyticsId" TEXT,
    "customHeadScripts" TEXT,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "supportChatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "supportChatChannelId" TEXT,
    "supportChatPosition" TEXT NOT NULL DEFAULT 'right',
    "supportChatColor" TEXT NOT NULL DEFAULT '#6366f1',
    "supportChatWelcome" TEXT,
    "supportChatWelcomeAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_configs" (
    "id" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "displayName" TEXT NOT NULL,
    "displayNameAr" TEXT NOT NULL DEFAULT '',
    "monthlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "messagesPerMonth" INTEGER NOT NULL DEFAULT 100,
    "maxAgents" INTEGER NOT NULL DEFAULT 1,
    "maxChannels" INTEGER NOT NULL DEFAULT 1,
    "maxKnowledgeBases" INTEGER NOT NULL DEFAULT 0,
    "maxTeamMembers" INTEGER NOT NULL DEFAULT 1,
    "maxTokensPerMonth" INTEGER NOT NULL DEFAULT 500000,
    "aiConversationsPerMonth" INTEGER NOT NULL DEFAULT 100,
    "overagePricePerConversation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "apiAccess" BOOLEAN NOT NULL DEFAULT false,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "features" TEXT NOT NULL DEFAULT '[]',
    "featuresAr" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "country" TEXT,
    "city" TEXT,
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_ips" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "blockedBy" TEXT,
    "autoBlock" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_ips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'ERROR',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "source" TEXT,
    "path" TEXT,
    "method" TEXT,
    "userId" TEXT,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" INTEGER,
    "requestBody" TEXT,
    "responseBody" TEXT,
    "duration" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subjectAr" TEXT NOT NULL DEFAULT '',
    "bodyHtml" TEXT NOT NULL,
    "bodyHtmlAr" TEXT NOT NULL DEFAULT '',
    "bodyText" TEXT,
    "variables" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_email_campaigns" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "status" "BulkEmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "targetFilter" JSONB NOT NULL,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_page_content" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "heroEnabled" BOOLEAN NOT NULL DEFAULT true,
    "heroTitle" TEXT NOT NULL DEFAULT 'AI-Powered Customer Support',
    "heroTitleAr" TEXT NOT NULL DEFAULT 'دعم العملاء بالذكاء الاصطناعي',
    "heroSubtitle" TEXT NOT NULL DEFAULT 'Automate your customer support with intelligent AI agents',
    "heroSubtitleAr" TEXT NOT NULL DEFAULT 'أتمت دعم العملاء مع وكلاء ذكاء اصطناعي',
    "heroCta" TEXT NOT NULL DEFAULT 'Get Started Free',
    "heroCtaAr" TEXT NOT NULL DEFAULT 'ابدأ مجاناً',
    "heroCtaLink" TEXT NOT NULL DEFAULT '/register',
    "heroImage" TEXT,
    "showNoCreditCard" BOOLEAN NOT NULL DEFAULT true,
    "badgeText" TEXT NOT NULL DEFAULT 'Powered by AI',
    "badgeTextAr" TEXT NOT NULL DEFAULT 'مدعوم بالذكاء الاصطناعي',
    "trustedByEnabled" BOOLEAN NOT NULL DEFAULT false,
    "trustedByTitle" TEXT NOT NULL DEFAULT 'Trusted By',
    "trustedByTitleAr" TEXT NOT NULL DEFAULT 'موثوق من قبل',
    "trustedByLogos" JSONB NOT NULL DEFAULT '[]',
    "featuresEnabled" BOOLEAN NOT NULL DEFAULT true,
    "featuresTitle" TEXT NOT NULL DEFAULT 'Why Choose Mojeeb?',
    "featuresTitleAr" TEXT NOT NULL DEFAULT 'لماذا تختار مجيب؟',
    "featuresSubtitle" TEXT NOT NULL DEFAULT 'Everything you need to deliver exceptional customer support',
    "featuresSubtitleAr" TEXT NOT NULL DEFAULT 'كل ما تحتاجه لتقديم دعم عملاء استثنائي',
    "features" JSONB NOT NULL DEFAULT '[]',
    "featuresAr" JSONB NOT NULL DEFAULT '[]',
    "statsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "statsCustomers" TEXT NOT NULL DEFAULT '500+',
    "statsMessages" TEXT NOT NULL DEFAULT '10M+',
    "statsLanguages" TEXT NOT NULL DEFAULT '20+',
    "statsUptime" TEXT NOT NULL DEFAULT '99.9%',
    "pricingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pricingTitle" TEXT NOT NULL DEFAULT 'Simple, Transparent Pricing',
    "pricingTitleAr" TEXT NOT NULL DEFAULT 'أسعار بسيطة وشفافة',
    "pricingSubtitle" TEXT NOT NULL DEFAULT 'Choose the plan that fits your business',
    "pricingSubtitleAr" TEXT NOT NULL DEFAULT 'اختر الخطة المناسبة لعملك',
    "showYearlyToggle" BOOLEAN NOT NULL DEFAULT true,
    "yearlyDiscount" INTEGER NOT NULL DEFAULT 20,
    "enterpriseCtaText" TEXT NOT NULL DEFAULT 'Contact Sales',
    "enterpriseCtaTextAr" TEXT NOT NULL DEFAULT 'تواصل مع المبيعات',
    "enterpriseCtaLink" TEXT NOT NULL DEFAULT '/contact',
    "testimonialsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "testimonialsTitle" TEXT NOT NULL DEFAULT 'What Our Customers Say',
    "testimonialsTitleAr" TEXT NOT NULL DEFAULT 'ماذا يقول عملاؤنا',
    "testimonialsSubtitle" TEXT NOT NULL DEFAULT 'Trusted by businesses worldwide',
    "testimonialsSubtitleAr" TEXT NOT NULL DEFAULT 'موثوق من الشركات حول العالم',
    "testimonialsMaxDisplay" INTEGER NOT NULL DEFAULT 3,
    "testimonials" JSONB NOT NULL DEFAULT '[]',
    "testimonialsAr" JSONB NOT NULL DEFAULT '[]',
    "faqEnabled" BOOLEAN NOT NULL DEFAULT true,
    "faqTitle" TEXT NOT NULL DEFAULT 'Frequently Asked Questions',
    "faqTitleAr" TEXT NOT NULL DEFAULT 'الأسئلة الشائعة',
    "faqSubtitle" TEXT NOT NULL DEFAULT 'Find answers to common questions',
    "faqSubtitleAr" TEXT NOT NULL DEFAULT 'اعثر على إجابات للأسئلة الشائعة',
    "faqMaxDisplay" INTEGER NOT NULL DEFAULT 5,
    "faqShowViewAll" BOOLEAN NOT NULL DEFAULT true,
    "bottomCtaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bottomCtaTitle" TEXT NOT NULL DEFAULT 'Ready to Transform Your Customer Support?',
    "bottomCtaTitleAr" TEXT NOT NULL DEFAULT 'مستعد لتحويل دعم عملائك؟',
    "bottomCtaSubtitle" TEXT NOT NULL DEFAULT 'Start your free trial today. No credit card required.',
    "bottomCtaSubtitleAr" TEXT NOT NULL DEFAULT 'ابدأ تجربتك المجانية اليوم. لا حاجة لبطاقة ائتمان.',
    "bottomCtaButtonText" TEXT NOT NULL DEFAULT 'Get Started Free',
    "bottomCtaButtonTextAr" TEXT NOT NULL DEFAULT 'ابدأ مجاناً',
    "bottomCtaButtonLink" TEXT NOT NULL DEFAULT '/register',
    "footerCopyrightText" TEXT NOT NULL DEFAULT '© 2025 Mojeeb. All rights reserved.',
    "footerCopyrightTextAr" TEXT NOT NULL DEFAULT '© 2025 مجيب. جميع الحقوق محفوظة.',
    "footerShowSocialLinks" BOOLEAN NOT NULL DEFAULT true,
    "footerTwitter" TEXT NOT NULL DEFAULT '',
    "footerLinkedin" TEXT NOT NULL DEFAULT '',
    "footerInstagram" TEXT NOT NULL DEFAULT '',
    "footerFacebook" TEXT NOT NULL DEFAULT '',
    "footerLinks" JSONB NOT NULL DEFAULT '[]',
    "footerText" TEXT NOT NULL DEFAULT '© 2025 Mojeeb. All rights reserved.',
    "footerTextAr" TEXT NOT NULL DEFAULT '© 2025 مجيب. جميع الحقوق محفوظة.',
    "customCss" TEXT,
    "seoMetaTitle" TEXT NOT NULL DEFAULT 'Mojeeb - AI-Powered Customer Support',
    "seoMetaTitleAr" TEXT NOT NULL DEFAULT 'مجيب - دعم العملاء بالذكاء الاصطناعي',
    "seoMetaDescription" TEXT NOT NULL DEFAULT 'Automate your customer support with intelligent AI agents',
    "seoMetaDescriptionAr" TEXT NOT NULL DEFAULT 'أتمت دعم العملاء مع وكلاء ذكاء اصطناعي',
    "seoOgImage" TEXT,
    "seoGoogleAnalyticsId" TEXT NOT NULL DEFAULT '',
    "seoCustomHeadCode" TEXT,
    "seoCustomFooterCode" TEXT,
    "seoFavicon" TEXT,
    "maintenanceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceTitle" TEXT NOT NULL DEFAULT 'We''ll Be Back Soon',
    "maintenanceTitleAr" TEXT NOT NULL DEFAULT 'سنعود قريباً',
    "maintenanceMessage" TEXT NOT NULL DEFAULT 'We''re currently performing scheduled maintenance. Please check back shortly.',
    "maintenanceMessageAr" TEXT NOT NULL DEFAULT 'نقوم حالياً بصيانة مجدولة. يرجى المحاولة مرة أخرى قريباً.',
    "sectionOrder" JSONB NOT NULL DEFAULT '["hero","trustedBy","features","stats","pricing","testimonials","faq","bottomCta"]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_notes" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL DEFAULT '',
    "contentEn" TEXT NOT NULL,
    "contentAr" TEXT NOT NULL DEFAULT '',
    "shortcut" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "agentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "autoTrigger" JSONB NOT NULL DEFAULT '{"enabled":false,"keywords":[]}',
    "userId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_usages" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "agentId" TEXT,
    "conversationId" TEXT,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "costUsd" DECIMAL(10,6) NOT NULL,
    "pipelineType" TEXT NOT NULL DEFAULT 'response',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "questionAr" TEXT NOT NULL DEFAULT '',
    "answer" TEXT NOT NULL,
    "answerAr" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_contents" (
    "id" TEXT NOT NULL,
    "contentEn" TEXT NOT NULL DEFAULT '',
    "contentAr" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT '',
    "roleAr" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "contentAr" TEXT NOT NULL DEFAULT '',
    "photoUrl" TEXT,
    "company" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_dismissals" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_isSuperAdmin_idx" ON "users"("isSuperAdmin");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "org_memberships_orgId_idx" ON "org_memberships"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "org_memberships_userId_orgId_key" ON "org_memberships"("userId", "orgId");

-- CreateIndex
CREATE INDEX "agents_orgId_idx" ON "agents"("orgId");

-- CreateIndex
CREATE INDEX "agents_orgId_isActive_idx" ON "agents"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "knowledge_bases_orgId_idx" ON "knowledge_bases"("orgId");

-- CreateIndex
CREATE INDEX "kb_documents_knowledgeBaseId_idx" ON "kb_documents"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "kb_documents_crawlJobId_idx" ON "kb_documents"("crawlJobId");

-- CreateIndex
CREATE INDEX "kb_chunks_documentId_idx" ON "kb_chunks"("documentId");

-- CreateIndex
CREATE INDEX "crawl_jobs_knowledgeBaseId_idx" ON "crawl_jobs"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "crawl_jobs_status_idx" ON "crawl_jobs"("status");

-- CreateIndex
CREATE INDEX "crawl_configs_knowledgeBaseId_idx" ON "crawl_configs"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "crawl_configs_scheduleEnabled_idx" ON "crawl_configs"("scheduleEnabled");

-- CreateIndex
CREATE INDEX "channels_orgId_idx" ON "channels"("orgId");

-- CreateIndex
CREATE INDEX "channels_webhookSecret_idx" ON "channels"("webhookSecret");

-- CreateIndex
CREATE UNIQUE INDEX "channels_orgId_type_externalId_key" ON "channels"("orgId", "type", "externalId");

-- CreateIndex
CREATE INDEX "conversations_orgId_status_idx" ON "conversations"("orgId", "status");

-- CreateIndex
CREATE INDEX "conversations_orgId_channelId_idx" ON "conversations"("orgId", "channelId");

-- CreateIndex
CREATE INDEX "conversations_orgId_lastMessageAt_idx" ON "conversations"("orgId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "conversations_orgId_agentId_idx" ON "conversations"("orgId", "agentId");

-- CreateIndex
CREATE INDEX "conversations_orgId_status_lastMessageAt_idx" ON "conversations"("orgId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "conversations_customerId_channelId_idx" ON "conversations"("customerId", "channelId");

-- CreateIndex
CREATE INDEX "conversations_channelId_idx" ON "conversations"("channelId");

-- CreateIndex
CREATE INDEX "conversations_agentId_idx" ON "conversations"("agentId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_conversationId_role_idx" ON "messages"("conversationId", "role");

-- CreateIndex
CREATE INDEX "messages_externalId_idx" ON "messages"("externalId");

-- CreateIndex
CREATE INDEX "messages_humanAgentId_idx" ON "messages"("humanAgentId");

-- CreateIndex
CREATE INDEX "messages_deliveryStatus_idx" ON "messages"("deliveryStatus");

-- CreateIndex
CREATE INDEX "tags_orgId_idx" ON "tags"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_orgId_name_key" ON "tags"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_tags_conversationId_tagId_key" ON "conversation_tags"("conversationId", "tagId");

-- CreateIndex
CREATE INDEX "conversation_ratings_conversationId_idx" ON "conversation_ratings"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_ratings_conversationId_customerId_key" ON "conversation_ratings"("conversationId", "customerId");

-- CreateIndex
CREATE INDEX "leads_orgId_status_idx" ON "leads"("orgId", "status");

-- CreateIndex
CREATE INDEX "leads_orgId_createdAt_idx" ON "leads"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "leads_orgId_assignedTo_idx" ON "leads"("orgId", "assignedTo");

-- CreateIndex
CREATE INDEX "leads_conversationId_idx" ON "leads"("conversationId");

-- CreateIndex
CREATE INDEX "leads_assignedTo_idx" ON "leads"("assignedTo");

-- CreateIndex
CREATE INDEX "leads_orgId_email_idx" ON "leads"("orgId", "email");

-- CreateIndex
CREATE INDEX "leads_orgId_phone_idx" ON "leads"("orgId", "phone");

-- CreateIndex
CREATE INDEX "demo_requests_status_idx" ON "demo_requests"("status");

-- CreateIndex
CREATE INDEX "demo_requests_createdAt_idx" ON "demo_requests"("createdAt");

-- CreateIndex
CREATE INDEX "contact_messages_status_idx" ON "contact_messages"("status");

-- CreateIndex
CREATE INDEX "contact_messages_createdAt_idx" ON "contact_messages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_orgId_key" ON "subscriptions"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_kashierSubscriptionId_key" ON "subscriptions"("kashierSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_paypalSubscriptionId_key" ON "subscriptions"("paypalSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_plan_idx" ON "subscriptions"("plan");

-- CreateIndex
CREATE INDEX "subscriptions_status_createdAt_idx" ON "subscriptions"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_kashierOrderId_key" ON "invoices"("kashierOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripeInvoiceId_key" ON "invoices"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_paypalOrderId_key" ON "invoices"("paypalOrderId");

-- CreateIndex
CREATE INDEX "invoices_subscriptionId_idx" ON "invoices"("subscriptionId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_paidAt_idx" ON "invoices"("paidAt");

-- CreateIndex
CREATE INDEX "invoices_status_paidAt_idx" ON "invoices"("status", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_orgId_idx" ON "api_keys"("orgId");

-- CreateIndex
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_keyHash_revokedAt_idx" ON "api_keys"("keyHash", "revokedAt");

-- CreateIndex
CREATE INDEX "analytics_events_orgId_eventType_date_idx" ON "analytics_events"("orgId", "eventType", "date");

-- CreateIndex
CREATE INDEX "analytics_events_orgId_date_idx" ON "analytics_events"("orgId", "date");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_orgId_idx" ON "notifications"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE INDEX "verification_tokens_token_idx" ON "verification_tokens"("token");

-- CreateIndex
CREATE INDEX "verification_tokens_userId_type_idx" ON "verification_tokens"("userId", "type");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "announcements_isActive_startsAt_idx" ON "announcements"("isActive", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_orgId_userId_key" ON "notification_preferences"("orgId", "userId");

-- CreateIndex
CREATE INDEX "webhooks_orgId_idx" ON "webhooks"("orgId");

-- CreateIndex
CREATE INDEX "webhooks_orgId_isActive_idx" ON "webhooks"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "lead_activities_leadId_createdAt_idx" ON "lead_activities"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "plan_configs_plan_key" ON "plan_configs"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX "system_configs_category_idx" ON "system_configs"("category");

-- CreateIndex
CREATE INDEX "login_activities_userId_createdAt_idx" ON "login_activities"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "login_activities_email_createdAt_idx" ON "login_activities"("email", "createdAt");

-- CreateIndex
CREATE INDEX "login_activities_ipAddress_createdAt_idx" ON "login_activities"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "login_activities_success_createdAt_idx" ON "login_activities"("success", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_ips_ip_key" ON "blocked_ips"("ip");

-- CreateIndex
CREATE INDEX "blocked_ips_ip_idx" ON "blocked_ips"("ip");

-- CreateIndex
CREATE INDEX "blocked_ips_expiresAt_idx" ON "blocked_ips"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "error_logs_level_createdAt_idx" ON "error_logs"("level", "createdAt");

-- CreateIndex
CREATE INDEX "error_logs_source_createdAt_idx" ON "error_logs"("source", "createdAt");

-- CreateIndex
CREATE INDEX "error_logs_createdAt_idx" ON "error_logs"("createdAt");

-- CreateIndex
CREATE INDEX "webhook_logs_webhookId_createdAt_idx" ON "webhook_logs"("webhookId", "createdAt");

-- CreateIndex
CREATE INDEX "webhook_logs_success_createdAt_idx" ON "webhook_logs"("success", "createdAt");

-- CreateIndex
CREATE INDEX "webhook_logs_event_createdAt_idx" ON "webhook_logs"("event", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_key_key" ON "email_templates"("key");

-- CreateIndex
CREATE INDEX "bulk_email_campaigns_status_idx" ON "bulk_email_campaigns"("status");

-- CreateIndex
CREATE INDEX "bulk_email_campaigns_createdAt_idx" ON "bulk_email_campaigns"("createdAt");

-- CreateIndex
CREATE INDEX "admin_notifications_userId_isRead_createdAt_idx" ON "admin_notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "conversation_notes_conversationId_createdAt_idx" ON "conversation_notes"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "conversation_notes_userId_idx" ON "conversation_notes"("userId");

-- CreateIndex
CREATE INDEX "message_templates_orgId_idx" ON "message_templates"("orgId");

-- CreateIndex
CREATE INDEX "message_templates_orgId_category_idx" ON "message_templates"("orgId", "category");

-- CreateIndex
CREATE INDEX "message_templates_orgId_isActive_idx" ON "message_templates"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "message_templates_orgId_isShared_idx" ON "message_templates"("orgId", "isShared");

-- CreateIndex
CREATE INDEX "message_templates_userId_idx" ON "message_templates"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_orgId_shortcut_key" ON "message_templates"("orgId", "shortcut");

-- CreateIndex
CREATE INDEX "token_usages_orgId_createdAt_idx" ON "token_usages"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "token_usages_createdAt_idx" ON "token_usages"("createdAt");

-- CreateIndex
CREATE INDEX "faqs_isActive_sortOrder_idx" ON "faqs"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "testimonials_isActive_sortOrder_idx" ON "testimonials"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_dismissals_announcementId_userId_key" ON "announcement_dismissals"("announcementId", "userId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "crawl_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "kb_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_knowledge_bases" ADD CONSTRAINT "agent_knowledge_bases_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_knowledge_bases" ADD CONSTRAINT "agent_knowledge_bases_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_configId_fkey" FOREIGN KEY ("configId") REFERENCES "crawl_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_configs" ADD CONSTRAINT "crawl_configs_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_agents" ADD CONSTRAINT "channel_agents_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_agents" ADD CONSTRAINT "channel_agents_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_humanAgentId_fkey" FOREIGN KEY ("humanAgentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_ratings" ADD CONSTRAINT "conversation_ratings_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_activities" ADD CONSTRAINT "login_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_ips" ADD CONSTRAINT "blocked_ips_blockedBy_fkey" FOREIGN KEY ("blockedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_email_campaigns" ADD CONSTRAINT "bulk_email_campaigns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_usages" ADD CONSTRAINT "token_usages_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_dismissals" ADD CONSTRAINT "announcement_dismissals_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- HNSW index for knowledge-base semantic search (cosine distance).
-- Prisma cannot describe this index in schema.prisma, so it lives only here; note that
-- `prisma db push` drops it — use migrations (`prisma migrate deploy`) to change the schema.
-- m = 16: max connections per layer; ef_construction = 64: build-time candidate list size.
CREATE INDEX "kb_chunks_embedding_idx" ON "kb_chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);
