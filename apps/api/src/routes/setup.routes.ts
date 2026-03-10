import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';

const router: Router = Router();

// POST /api/v1/setup/complete — mark onboarding as completed
router.post('/complete', authenticate, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: (req.user as any).userId },
      data: { onboardingCompleted: true },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
