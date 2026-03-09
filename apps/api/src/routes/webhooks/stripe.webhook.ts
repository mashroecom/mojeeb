import { Router, type Request, type Response } from 'express';
import { stripeService } from '../../services/stripe.service';
import { logger } from '../../config/logger';
import { webhookLimiter } from '../../middleware/rateLimiter';

const router: Router = Router();

router.use(webhookLimiter);

// POST /api/v1/webhooks/stripe
router.post('/', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string | undefined;

    if (!signature) {
      logger.warn('Stripe webhook received without signature header');
      res.status(401).json({ success: false, error: 'Missing signature' });
      return;
    }

    // Use raw body preserved by express.json verify callback for accurate signature verification
    const rawBody = (req as any).rawBody
      ? (req as any).rawBody.toString()
      : JSON.stringify(req.body);

    // Verify webhook signature using Stripe SDK
    const event = await stripeService.verifyWebhookSignature(rawBody, signature);

    // Process webhook events
    switch (event.type) {
      case 'checkout.session.completed':
        await stripeService.handleCheckoutComplete(event.data.object.id);
        break;

      case 'invoice.payment_succeeded':
        await stripeService.handleInvoicePaymentSucceeded(event.data.object as any);
        break;

      case 'invoice.payment_failed':
        await stripeService.handleInvoicePaymentFailed(event.data.object as any);
        break;

      case 'customer.subscription.updated':
        await stripeService.handleSubscriptionUpdated(event.data.object as any);
        break;

      case 'customer.subscription.deleted':
        await stripeService.handleSubscriptionDeleted(event.data.object as any);
        break;

      default:
        logger.info({ eventType: event.type }, 'Unhandled Stripe webhook event type');
    }

    res.status(200).json({ success: true });
  } catch (err) {
    logger.error({ err, body: req.body }, 'Error processing Stripe webhook');
    // Always return 200 to prevent Stripe from retrying indefinitely
    res.status(200).json({ success: true });
  }
});

export default router;
