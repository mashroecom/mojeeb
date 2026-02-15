import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, orgContext } from '../middleware/auth';
import { validate } from '../middleware/validate';

interface NoteParams { orgId: string; conversationId: string; noteId: string; [key: string]: string; }

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// GET /api/v1/organizations/:orgId/conversations/:conversationId/notes
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, conversationId } = req.params as unknown as NoteParams;
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, orgId },
      select: { id: true },
    });
    if (!conv) return res.status(404).json({ success: false, error: 'Conversation not found' });

    const notes = await prisma.conversationNote.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: notes });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/conversations/:conversationId/notes
router.post(
  '/',
  validate({ body: z.object({ content: z.string().min(1).max(5000).trim() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId, conversationId } = req.params as unknown as NoteParams;
      const { content } = req.body;

      const conv = await prisma.conversation.findFirst({
        where: { id: conversationId, orgId },
        select: { id: true },
      });
      if (!conv) return res.status(404).json({ success: false, error: 'Conversation not found' });

      const note = await prisma.conversationNote.create({
        data: {
          conversationId,
          userId: (req as any).user.userId,
          content: content.trim(),
        },
      });
      res.status(201).json({ success: true, data: note });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/organizations/:orgId/conversations/:conversationId/notes/:noteId
router.patch(
  '/:noteId',
  validate({ body: z.object({ content: z.string().min(1).max(5000).trim() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orgId, conversationId, noteId } = req.params as unknown as NoteParams;
      const { content } = req.body;

      const conv = await prisma.conversation.findFirst({
        where: { id: conversationId, orgId },
        select: { id: true },
      });
      if (!conv) return res.status(404).json({ success: false, error: 'Conversation not found' });

      const note = await prisma.conversationNote.findFirst({
        where: { id: noteId, conversationId, userId: (req as any).user.userId },
      });
      if (!note) return res.status(404).json({ success: false, error: 'Note not found' });

      const updated = await prisma.conversationNote.update({
        where: { id: noteId },
        data: { content: content.trim() },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/organizations/:orgId/conversations/:conversationId/notes/:noteId
router.delete('/:noteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, conversationId, noteId } = req.params as unknown as NoteParams;
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, orgId },
      select: { id: true },
    });
    if (!conv) return res.status(404).json({ success: false, error: 'Conversation not found' });

    const note = await prisma.conversationNote.findFirst({
      where: { id: noteId, conversationId },
    });
    if (!note) return res.status(404).json({ success: false, error: 'Note not found' });

    await prisma.conversationNote.delete({ where: { id: noteId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
