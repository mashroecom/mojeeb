import { Router, type Request, type Response } from 'express';
import { paypalService, type PayPalWebhookPayload } from '../../services/paypal.service';
import { logger } from '../../config/logger';
import { webhookLimiter } from '../../middleware/rateLimiter';

const router: Router = Router();

router.use(webhookLimiter);

// POST /api/v1/webhooks/paypal
router.post('/', async (req: Request, res: Response) => {
  try {
    // Use raw body preserved by express.json verify callback for accurate signature verification
    const rawBody = (req as any).rawBody
      ? (req as any).rawBody.toString()
      : JSON.stringify(req.body);

    // Get all headers for PayPal signature verification
    const headers: Record<string, string> = {};
    Object.keys(req.headers).forEach((key) => {
      const value = req.headers[key];
      if (typeof value === 'string') {
        headers[key] = value;
      } else if (Array.isArray(value) && value[0]) {
        headers[key] = value[0];
      }
    });

    const isValid = await paypalService.verifyWebhookSignature(headers, rawBody);
    if (!isValid) {
      logger.warn('Invalid PayPal webhook signature');
      res.status(401).json({ success: false, error: 'Invalid signature' });
      return;
    }

    const payload = req.body as PayPalWebhookPayload;

    // Process the webhook asynchronously but acknowledge immediately
    // Route to appropriate handler based on event type
    switch (payload.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await paypalService.handlePaymentCaptureCompleted(payload.resource);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        await paypalService.handlePaymentCaptureDenied(payload.resource);
        break;
      case 'BILLING.SUBSCRIPTION.CREATED':
        await paypalService.handleSubscriptionCreated(payload.resource);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await paypalService.handleSubscriptionCancelled(payload.resource);
        break;
      case 'BILLING.SUBSCRIPTION.UPDATED':
        await paypalService.handleSubscriptionUpdated(payload.resource);
        break;
      default:
        logger.info({ eventType: payload.event_type }, 'Unhandled PayPal webhook event type');
    }

    res.status(200).json({ success: true });
  } catch (err) {
    logger.error({ err, body: req.body }, 'Error processing PayPal webhook');
    // Always return 200 to prevent PayPal from retrying indefinitely
    res.status(200).json({ success: true });
  }
});

export default router;
