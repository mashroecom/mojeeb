import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../config/database';
import { emailQueue } from '../queues';
import { logger } from '../config/logger';

const router: Router = Router();

const demoRequestSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  email: z.string().email().max(254).trim().toLowerCase(),
  phone: z.string().min(5).max(30).trim(),
  company: z.string().max(200).trim().optional(),
  message: z.string().max(2000).trim().optional(),
});

const demoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || 'unknown',
  message: { success: false, error: 'Too many demo requests, please try again later' },
});

// POST /api/v1/demo-requests — public, no auth required
router.post('/', demoLimiter, async (req, res, next) => {
  try {
    const parsed = demoRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid input',
      });
    }

    const { name, email, phone, company, message } = parsed.data;

    const demoRequest = await prisma.demoRequest.create({
      data: { name, email, phone, company, message },
    });

    // Queue notification email
    emailQueue
      .add('demoRequest', { type: 'demoRequest', name, email, phone, company, message })
      .catch((err) => logger.warn({ err }, 'Failed to queue demo request notification email'));

    res.status(201).json({ success: true, data: { id: demoRequest.id } });
  } catch (err) {
    next(err);
  }
});

export default router;
