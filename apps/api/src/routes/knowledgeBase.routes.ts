import { Router } from 'express';
import { knowledgeBaseService } from '../services/knowledgeBase.service';
import { authenticate, orgContext } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

interface OrgParams { orgId: string; [key: string]: string; }
interface KbParams { orgId: string; kbId: string; [key: string]: string; }
interface DocParams { orgId: string; kbId: string; docId: string; [key: string]: string; }

const router: Router = Router({ mergeParams: true });

router.use(authenticate, orgContext);

// POST /api/v1/organizations/:orgId/knowledge-bases
router.post(
  '/',
  validate({
    body: z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId } = req.params as OrgParams;
      const kb = await knowledgeBaseService.create(orgId, req.body);
      res.status(201).json({ success: true, data: kb });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/organizations/:orgId/knowledge-bases
router.get('/', async (req, res, next) => {
  try {
    const { orgId } = req.params as OrgParams;
    const kbs = await knowledgeBaseService.list(orgId);
    res.json({ success: true, data: kbs });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/organizations/:orgId/knowledge-bases/:kbId
router.get('/:kbId', async (req, res, next) => {
  try {
    const { orgId, kbId } = req.params as KbParams;
    const kb = await knowledgeBaseService.getById(orgId, kbId);
    res.json({ success: true, data: kb });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/organizations/:orgId/knowledge-bases/:kbId
router.patch(
  '/:kbId',
  validate({
    body: z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
    }).refine((d) => d.name || d.description !== undefined, {
      message: 'At least one field (name or description) is required',
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId, kbId } = req.params as KbParams;
      const kb = await knowledgeBaseService.update(orgId, kbId, req.body);
      res.json({ success: true, data: kb });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/organizations/:orgId/knowledge-bases/:kbId
router.delete('/:kbId', async (req, res, next) => {
  try {
    const { orgId, kbId } = req.params as KbParams;
    await knowledgeBaseService.delete(orgId, kbId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/organizations/:orgId/knowledge-bases/:kbId/search
router.post(
  '/:kbId/search',
  validate({
    body: z.object({
      query: z.string().min(1).max(500),
      limit: z.number().min(1).max(20).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { orgId, kbId } = req.params as KbParams;
      // Verify KB belongs to org
      await knowledgeBaseService.getById(orgId, kbId);
      const results = await knowledgeBaseService.semanticSearch(kbId, req.body.query, req.body.limit || 5);
      res.json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/organizations/:orgId/knowledge-bases/:kbId/documents
router.post(
  '/:kbId/documents',
  validate({
    body: z.object({
      title: z.string().min(1).max(200),
      content: z.string().optional(),
      contentType: z.enum(['TEXT', 'FAQ', 'PDF', 'URL']).optional(),
      sourceUrl: z.string().url().optional(),
      fileBase64: z.string().optional(),
    }).refine(
      (d) => d.content || d.fileBase64 || d.sourceUrl,
      { message: 'One of content, fileBase64, or sourceUrl is required' },
    ),
  }),
  async (req, res, next) => {
    try {
      const { orgId, kbId } = req.params as KbParams;
      // Verify KB belongs to this org before adding document
      await knowledgeBaseService.getById(orgId, kbId);
      const doc = await knowledgeBaseService.addDocument(kbId, req.body);
      res.status(201).json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/organizations/:orgId/knowledge-bases/:kbId/documents/:docId
router.delete('/:kbId/documents/:docId', async (req, res, next) => {
  try {
    const { orgId, kbId, docId } = req.params as DocParams;
    // Verify KB belongs to this org before deleting document
    await knowledgeBaseService.getById(orgId, kbId);
    await knowledgeBaseService.deleteDocument(kbId, docId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
