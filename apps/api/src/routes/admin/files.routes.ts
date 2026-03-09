import path from 'path';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { fileManagerService } from '../../services/fileManager.service';
import { auditLogService } from '../../services/auditLog.service';
import { logger } from '../../config/logger';

const router: Router = Router();

// ── Multer config for admin file uploads ──
const storage = multer.diskStorage({
  destination: path.resolve(__dirname, '../../../uploads'),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// GET / — list files paginated
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || undefined;
    const type = (req.query.type as string) || undefined;

    const result = await fileManagerService.listFiles({ page, limit, search, type });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /stats — storage statistics
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await fileManagerService.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// POST / — upload a file
router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    const filename = req.file.filename;
    const relativePath = `/files/${filename}`;

    await auditLogService.log({
      userId: (req as any).user.id,
      action: 'UPLOAD_FILE',
      targetType: 'File',
      targetId: filename,
      metadata: { originalName: req.file.originalname, size: req.file.size, mimeType: req.file.mimetype },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    logger.info({ file: req.file.originalname, size: req.file.size }, 'Admin file uploaded');

    res.json({
      success: true,
      data: {
        name: req.file.originalname,
        relativePath,
        size: req.file.size,
        mimeType: req.file.mimetype,
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /:encodedPath — delete file (path is base64 encoded)
router.delete('/:encodedPath', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const relativePath = Buffer.from(String(req.params.encodedPath), 'base64').toString('utf-8');

    await fileManagerService.deleteFile(relativePath);

    await auditLogService.log({
      userId: (req as any).user.id,
      action: 'DELETE_FILE',
      targetType: 'File',
      targetId: relativePath,
      metadata: { path: relativePath },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'File deleted' });
  } catch (err: any) {
    if (err.message === 'Invalid file path' || err.message === 'Path traversal detected') {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err.code === 'ENOENT') {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    next(err);
  }
});

export default router;
