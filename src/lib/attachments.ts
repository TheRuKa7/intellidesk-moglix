/**
 * Local attachment storage — prototype stand-in for MinIO/S3 (AGPL).
 * Files stored under data/attachment-files/ with opaque keys.
 */
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

const ATTACHMENT_DIR = path.join(process.cwd(), 'data', 'attachment-files');

export function storeAttachmentFile(
  filename: string,
  data: Buffer,
): { storageKey: string; sizeBytes: number } {
  fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });
  const safeName = filename.replace(/[^\w.\-()+ ]/g, '_');
  const storageKey = `${randomUUID()}_${safeName}`;
  const fullPath = path.join(ATTACHMENT_DIR, storageKey);
  fs.writeFileSync(fullPath, data);
  return { storageKey, sizeBytes: data.length };
}

export function readAttachmentFile(storageKey: string): Buffer | null {
  const fullPath = path.join(ATTACHMENT_DIR, storageKey);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath);
}

export function attachmentFilePath(storageKey: string): string {
  return path.join(ATTACHMENT_DIR, storageKey);
}
