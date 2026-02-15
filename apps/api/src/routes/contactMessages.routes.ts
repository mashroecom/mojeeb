import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../config/database';
import { emailService } from '../services/email.service';
import { logger } from '../config/logger';

const router: Router = Router();

const contactSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  email: z.string().email().max(254).trim().toLowerCase(),
  subject: z.string().min(1).max(300).trim(),
  message: z.string().min(1).max(5000).trim(),
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || 'unknown',
  message: { success: false, error: 'Too many contact submissions, please try again later' },
});

// POST /api/v1/contact — public, no auth required
router.post('/', contactLimiter, async (req, res, next) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid input',
      });
    }

    const { name, email, subject, message } = parsed.data;

    const contact = await prisma.contactMessage.create({
      data: { name, email, subject, message },
    });

    // Send email notification (fire & forget)
    emailService.sendContactNotification({ name, email, subject, message }).catch((err) => {
      logger.warn({ err }, 'Failed to send contact notification email');
    });

    res.status(201).json({ success: true, data: { id: contact.id } });
  } catch (err) {
    next(err);
  }
});

export default router;
