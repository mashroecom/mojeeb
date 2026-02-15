import { Router, type Request, type Response } from 'express';
import { subscriptionService, type KashierWebhookPayload } from '../../services/subscription.service';
import { logger } from '../../config/logger';
import { webhookLimiter } from '../../middleware/rateLimiter';

const router: Router = Router();

router.use(webhookLimiter);

// POST /api/v1/webhooks/kashier
router.post('/', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-kashier-signature'] as string | undefined;

    if (!signature) {
      logger.warn('Kashier webhook received without signature header');
      res.status(401).json({ success: false, error: 'Missing signature' });
      return;
    }

    // Use raw body preserved by express.json verify callback for accurate signature verification
    const rawBody = (req as any).rawBody
      ? (req as any).rawBody.toString()
      : JSON.stringify(req.body);

    const isValid = await subscriptionService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.warn('Invalid Kashier webhook signature');
      res.status(401).json({ success: false, error: 'Invalid signature' });
      return;
    }

    const payload = req.body as KashierWebhookPayload;

    // Process the webhook asynchronously but acknowledge immediately
    await subscriptionService.handlePaymentWebhook(payload);

    res.status(200).json({ success: true });
  } catch (err) {
    logger.error({ err, body: req.body }, 'Error processing Kashier webhook');
    // Always return 200 to prevent Kashier from retrying indefinitely
    res.status(200).json({ success: true });
  }
});

export default router;
