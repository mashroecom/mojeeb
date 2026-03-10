import { Router } from 'express';
import authRoutes from './auth.routes';
import organizationRoutes from './organization.routes';
import agentsRoutes from './agents.routes';
import conversationsRoutes from './conversations.routes';
import knowledgeBaseRoutes from './knowledgeBase.routes';
import analyticsRoutes from './analytics.routes';
import leadsRoutes from './leads.routes';
import subscriptionRoutes from './subscription.routes';
import apiKeyRoutes from './apiKey.routes';
import channelRoutes from './channel.routes';
import notificationRoutes from './notifications.routes';
import whatsappWebhook from './webhooks/whatsapp.webhook';
import kashierWebhook from './webhooks/kashier.webhook';
import stripeWebhook from './webhooks/stripe.webhook';
import paypalWebhook from './webhooks/paypal.webhook';
import webchatRoutes from './webhooks/webchat.routes';
import demoRequestRoutes from './demoRequests.routes';
import contactMessageRoutes from './contactMessages.routes';
import tagRoutes from './tags.routes';
import exportRoutes from './export.routes';
import webhookMgmtRoutes from './webhook.routes';
import conversationNotesRoutes from './conversationNotes.routes';
import messageTemplateRoutes from './messageTemplates.routes';
import customersRoutes from './customers.routes';
import filesRoutes from './files.routes';
import templatesRoutes from './templates.routes';
import adminRoutes from './admin';
import publicRoutes from './public.routes';
import setupRoutes from './setup.routes';
import announcementsRoutes from './announcements.routes';
import mobileRoutes from './mobile.routes';
import { authenticate } from '../middleware/auth';

const router: Router = Router();

// Health check
router.get('/health', async (_req, res) => {
  const checks: Record<string, string> = {};
  try {
    const { prisma } = await import('../config/database');
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }
  try {
    const { redis } = await import('../config/redis');
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }
  const allOk = Object.values(checks).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// Readiness check — verifies DB, Redis, and BullMQ queue connectivity
router.get('/health/ready', async (_req, res) => {
  const checks: Record<string, string> = {};
  try {
    const { prisma } = await import('../config/database');
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }
  try {
    const { redis } = await import('../config/redis');
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }
  try {
    const { inboundQueue } = await import('../queues');
    await inboundQueue.getJobCounts();
    checks.queue = 'ok';
  } catch {
    checks.queue = 'error';
  }
  const allOk = Object.values(checks).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// Auth routes
router.use('/auth', authRoutes);

// Organization routes
router.use('/organizations/:orgId', organizationRoutes);

// Organization-scoped routes
router.use('/organizations/:orgId/agents', agentsRoutes);
router.use('/organizations/:orgId/conversations', conversationsRoutes);
router.use('/organizations/:orgId/knowledge-bases', knowledgeBaseRoutes);
router.use('/organizations/:orgId/analytics', analyticsRoutes);
router.use('/organizations/:orgId/leads', leadsRoutes);
router.use('/organizations/:orgId/subscription', subscriptionRoutes);
router.use('/organizations/:orgId/channels', channelRoutes);
router.use('/organizations/:orgId/api-keys', apiKeyRoutes);
router.use('/organizations/:orgId/notifications', notificationRoutes);
router.use('/organizations/:orgId/tags', tagRoutes);
router.use('/organizations/:orgId/export', exportRoutes);
router.use('/organizations/:orgId/webhooks', webhookMgmtRoutes);
router.use('/organizations/:orgId/conversations/:conversationId/notes', conversationNotesRoutes);
router.use('/organizations/:orgId/message-templates', messageTemplateRoutes);
router.use('/organizations/:orgId/customers', customersRoutes);

// Incoming webhook routes
router.use('/webhooks/whatsapp', whatsappWebhook);
router.use('/webhooks/kashier', kashierWebhook);
router.use('/webhooks/stripe', stripeWebhook);
router.use('/webhooks/paypal', paypalWebhook);

// Webchat routes (public, no auth required)
router.use('/webchat', webchatRoutes);

// File access routes (requires token or Bearer auth)
router.use('/files', filesRoutes);

// Demo request routes (public, no auth required)
router.use('/demo-requests', demoRequestRoutes);

// Contact message routes (public, no auth required)
router.use('/contact', contactMessageRoutes);

// Public routes (no auth, for landing page)
router.use('/public', publicRoutes);

// Setup / onboarding routes (authenticated, no orgContext needed)
router.use('/setup', setupRoutes);

// Announcements routes (authenticated, user-facing)
router.use('/announcements', authenticate, announcementsRoutes);

// Templates routes (requires authentication)
router.use('/templates', templatesRoutes);

// Super Admin routes (requires authentication + super admin)
router.use('/admin', adminRoutes);

// Mobile routes (requires authentication)
router.use('/mobile', mobileRoutes);

export default router;
