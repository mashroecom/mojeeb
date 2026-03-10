import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../config/logger';

const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const SUPPORTED_EXTENSIONS = new Set(Object.keys(MIME_MAP));

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

export function isSupportedImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

export function resolveUploadPath(uploadUrl: string): string {
  const filename = uploadUrl.replace(/^\/uploads\//, '');
  // BUG FIX: prevent path traversal (e.g. ../../etc/passwd)
  const resolved = path.resolve(UPLOADS_DIR, filename);
  if (!resolved.startsWith(UPLOADS_DIR)) {
    throw new Error('Invalid upload path: directory traversal detected');
  }
  return resolved;
}

export async function imageToBase64DataUrl(
  uploadUrl: string,
): Promise<{ dataUrl: string; mimeType: string } | null> {
  try {
    const filePath = resolveUploadPath(uploadUrl);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_MAP[ext];

    if (!mimeType) {
      logger.warn({ uploadUrl, ext }, 'Unsupported image extension for vision');
      return null;
    }

    const stat = await fs.stat(filePath);
    if (stat.size > MAX_IMAGE_SIZE) {
      logger.warn(
        { uploadUrl, sizeMB: Math.round(stat.size / 1024 / 1024) },
        'Image too large for vision, skipping',
      );
      return null;
    }

    const buffer = await fs.readFile(filePath);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    logger.debug(
      { uploadUrl, mimeType, fileSizeKB: Math.round(buffer.length / 1024) },
      'Image converted to base64 for vision',
    );

    return { dataUrl, mimeType };
  } catch (err) {
    logger.error({ err, uploadUrl }, 'Failed to read image for vision');
    return null;
  }
}
