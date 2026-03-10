import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../config/logger';

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Map file extensions to MIME types
function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.zip': 'application/zip',
  };
  return mimeMap[ext.toLowerCase()] || 'application/octet-stream';
}

function getFileGroup(mimeType: string): 'images' | 'documents' | 'other' {
  if (mimeType.startsWith('image/')) return 'images';
  if (
    mimeType.startsWith('application/pdf') ||
    mimeType.startsWith('application/msword') ||
    mimeType.includes('officedocument') ||
    mimeType.startsWith('text/')
  ) {
    return 'documents';
  }
  return 'other';
}

interface FileEntry {
  name: string;
  relativePath: string;
  size: number;
  mimeType: string;
  modifiedAt: string;
  isDirectory: boolean;
}

async function walkDir(dir: string, baseDir: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];

  try {
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      if (item.isDirectory()) {
        entries.push({
          name: item.name,
          relativePath,
          size: 0,
          mimeType: 'directory',
          modifiedAt: new Date().toISOString(),
          isDirectory: true,
        });
        // Recurse into sub-directories
        const subEntries = await walkDir(fullPath, baseDir);
        entries.push(...subEntries);
      } else {
        const stat = await fs.stat(fullPath);
        const ext = path.extname(item.name);
        entries.push({
          name: item.name,
          relativePath,
          size: stat.size,
          mimeType: getMimeType(ext),
          modifiedAt: stat.mtime.toISOString(),
          isDirectory: false,
        });
      }
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      logger.warn({ err, dir }, 'Error reading directory');
    }
  }

  return entries;
}

export class FileManagerService {
  async listFiles(params: { page: number; limit: number; search?: string; type?: string }) {
    const { page, limit, search, type } = params;

    // Ensure uploads directory exists
    try {
      await fs.access(UPLOADS_DIR);
    } catch {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
    }

    let allFiles = await walkDir(UPLOADS_DIR, UPLOADS_DIR);

    // Filter by search
    if (search) {
      const lowerSearch = search.toLowerCase();
      allFiles = allFiles.filter((f) => f.name.toLowerCase().includes(lowerSearch));
    }

    // Filter by type group
    if (type && type !== 'all') {
      allFiles = allFiles.filter((f) => {
        if (f.isDirectory) return type === 'other';
        return getFileGroup(f.mimeType) === type;
      });
    }

    // Sort by modification date descending
    allFiles.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    const total = allFiles.length;
    const start = (page - 1) * limit;
    const files = allFiles.slice(start, start + limit);

    return {
      files,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats() {
    try {
      await fs.access(UPLOADS_DIR);
    } catch {
      return { totalFiles: 0, totalSize: 0, images: 0, documents: 0, other: 0 };
    }

    const allFiles = await walkDir(UPLOADS_DIR, UPLOADS_DIR);
    const files = allFiles.filter((f) => !f.isDirectory);

    const totalFiles = files.length;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const images = files.filter((f) => getFileGroup(f.mimeType) === 'images').length;
    const documents = files.filter((f) => getFileGroup(f.mimeType) === 'documents').length;
    const other = files.filter((f) => getFileGroup(f.mimeType) === 'other').length;

    return { totalFiles, totalSize, images, documents, other };
  }

  async deleteFile(relativePath: string) {
    // Normalize path and prevent traversal
    const normalized = path.normalize(relativePath).replace(/\\/g, '/');
    if (normalized.includes('..') || normalized.startsWith('/')) {
      throw new Error('Invalid file path');
    }

    const fullPath = path.join(UPLOADS_DIR, normalized);
    const resolvedPath = path.resolve(fullPath);

    // Ensure the resolved path is still within uploads directory
    if (!resolvedPath.startsWith(path.resolve(UPLOADS_DIR))) {
      throw new Error('Path traversal detected');
    }

    await fs.unlink(resolvedPath);
    return { success: true };
  }
}

export const fileManagerService = new FileManagerService();
