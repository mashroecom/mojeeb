import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { validateFileAccess } from '../middleware/fileAccess';
import { logger } from '../config/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';

const router: Router = Router();

// Path to uploads directory (same as static route in app.ts)
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// MIME type mapping for common file extensions
const MIME_TYPES: Record<string, string> = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  // Audio
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
};

/**
 * Prevent path traversal attacks
 * @param filename - The requested filename
 * @returns Sanitized filename or throws error
 */
function sanitizeFilename(filename: string): string {
  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new BadRequestError('Invalid filename: path traversal detected');
  }

  // Check for null bytes
  if (filename.includes('\0')) {
    throw new BadRequestError('Invalid filename: null byte detected');
  }

  return filename;
}

/**
 * Get MIME type from file extension
 * @param filename - The filename
 * @returns MIME type or application/octet-stream as fallback
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * GET /files/:filename
 * Serve uploaded files with authentication and authorization
 * Supports range requests for video/audio streaming
 */
router.get('/:filename', validateFileAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filename } = req.params as { filename: string };

    // Sanitize filename to prevent path traversal
    const safeFilename = sanitizeFilename(filename);

    // Construct absolute file path
    const filePath = path.join(UPLOADS_DIR, safeFilename);

    // Verify file exists and is actually in uploads directory (extra safety check)
    const normalizedPath = path.normalize(filePath);
    const normalizedUploadsDir = path.normalize(UPLOADS_DIR);
    if (!normalizedPath.startsWith(normalizedUploadsDir)) {
      logger.warn({ filename, filePath, normalizedPath }, 'Path traversal attempt detected');
      throw new BadRequestError('Invalid file path');
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('File not found');
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      throw new NotFoundError('Not a file');
    }

    const fileSize = stats.size;
    const mimeType = getMimeType(safeFilename);

    // Handle range requests (for video/audio streaming)
    const range = req.headers.range;
    if (range) {
      // Parse range header (format: "bytes=start-end")
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0] || '0', 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Validate range
      if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
        res.status(416).set({
          'Content-Range': `bytes */${fileSize}`,
        });
        return res.send('Requested range not satisfiable');
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize.toString(),
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      });

      fileStream.pipe(res);
      logger.debug({ filename, start, end, chunkSize }, 'Serving file range');
    } else {
      // Serve entire file
      res.status(200).set({
        'Content-Length': fileSize.toString(),
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      });

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      logger.debug({ filename, size: fileSize }, 'Serving full file');
    }
  } catch (err) {
    next(err);
  }
});

export default router;
