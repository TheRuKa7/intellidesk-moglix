import { getSetting } from './platform';

/** Account ticket ID prefix (e.g. INC-). Always ends without trailing digits. */
export function ticketIdPrefix(): string {
  const raw = getSetting('account.ticket_id_prefix') ?? 'INC-';
  return raw.trim() || 'INC-';
}

/** Escape for RegExp; match display numbers like INC-2176596. */
export function ticketNumberPattern(): RegExp {
  const prefix = ticketIdPrefix().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${prefix}\\d+`, 'i');
}

export function normalizeDisplayNumber(raw: string): string {
  const cleaned = raw.replace(/\[|\]/g, '').trim();
  const prefix = ticketIdPrefix();
  if (/^\d+$/.test(cleaned)) return `${prefix}${cleaned}`;
  return cleaned;
}
