import { getSetting } from './platform';

export function maxAttachmentBytes(): number {
  const mb = Number(getSetting('security.max_attachment_mb') ?? '25');
  const safe = Number.isFinite(mb) && mb > 0 ? mb : 25;
  return Math.round(safe * 1024 * 1024);
}

export function assertAttachmentWithinLimit(sizeBytes: number): void {
  const max = maxAttachmentBytes();
  if (sizeBytes > max) {
    throw new Error(`ATTACHMENT_TOO_LARGE:${Math.round(max / (1024 * 1024))}`);
  }
}

export async function collectFormAttachments(
  formData: FormData,
  fieldName = 'attachment',
): Promise<{ filename: string; data: Buffer; contentType?: string }[]> {
  const file = formData.get(fieldName) as File | null;
  if (!file || file.size <= 0) return [];
  assertAttachmentWithinLimit(file.size);
  return [
    {
      filename: file.name,
      data: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || undefined,
    },
  ];
}
