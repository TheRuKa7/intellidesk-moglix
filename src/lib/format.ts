import { REQUESTER_STATUS_LABELS } from './constants';
import { getSetting } from './platform';

export function accountTimezone(): string {
  return getSetting('account.timezone') ?? 'Asia/Kolkata';
}

export function accountLocale(): string {
  return getSetting('account.locale') ?? 'en-IN';
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const locale = accountLocale();
  const timeZone = accountTimezone();
  return new Date(iso).toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone,
  });
}

export function formatStatusLabel(name: string, forRequester = false): string {
  if (!forRequester) return name;
  return REQUESTER_STATUS_LABELS[name] ?? name;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Calendar-day match for "Due today" KPIs using account timezone. */
export function isDueToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const timeZone = accountTimezone();
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone });
  return day(new Date(iso)) === day(new Date());
}

export function ticketDueToday(input: {
  statusCategory: string;
  slaClock: string;
  respondBy: string | null;
  resolveBy: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
}): boolean {
  return ticketDueBucket(input) === 'today';
}

/** Active SLA deadline used for Due-by filters. */
export function ticketActiveDeadline(input: {
  statusCategory: string;
  slaClock: string;
  respondBy: string | null;
  resolveBy: string | null;
  firstResponseAt: string | null;
}): string | null {
  if (input.statusCategory === 'done' || input.slaClock === 'pause' || input.slaClock === 'stop') {
    return null;
  }
  return !input.firstResponseAt ? input.respondBy : input.resolveBy;
}

/** Freshservice Due-by buckets: overdue | today | tomorrow | next8h */
export function ticketDueBucket(input: {
  statusCategory: string;
  slaClock: string;
  respondBy: string | null;
  resolveBy: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
}): 'overdue' | 'today' | 'tomorrow' | 'next8h' | null {
  const deadline = ticketActiveDeadline(input);
  if (!deadline) return null;
  const dueMs = new Date(deadline).getTime();
  const now = Date.now();
  if (dueMs <= now) return 'overdue';
  if (isDueToday(deadline)) return 'today';
  const timeZone = accountTimezone();
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone });
  const tomorrow = new Date(now + 86400_000);
  if (day(new Date(deadline)) === day(tomorrow)) return 'tomorrow';
  if (dueMs - now <= 8 * 3600_000) return 'next8h';
  return null;
}

/** Live countdown chip text, e.g. "57m 59s" or "Overdue". */
export function formatCountdown(deadline: string | null | undefined, options?: { paused?: boolean; met?: boolean }): string {
  if (options?.met) return 'Met';
  if (options?.paused) return 'Paused';
  if (!deadline) return '—';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Overdue';
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${mins}m`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export function slaStatusPhrase(input: {
  statusName: string;
  statusCategory: string;
  slaClock: string;
  respondBy: string | null;
  resolveBy: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  slaBreached?: boolean;
}): string {
  if (input.statusCategory === 'done') {
    if (input.resolvedAt && input.resolveBy) {
      const met = new Date(input.resolvedAt).getTime() <= new Date(input.resolveBy).getTime();
      return met ? 'Resolved on time' : 'Resolved late';
    }
    return input.statusName === 'Closed' ? 'Closed' : 'Resolved';
  }
  if (input.slaBreached) return 'Overdue';
  if (input.slaClock === 'pause') return 'Paused';
  const deadline = !input.firstResponseAt ? input.respondBy : input.resolveBy;
  if (!deadline) return '—';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Overdue';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `Due in ${days} day${days === 1 ? '' : 's'}`;
  }
  if (hours >= 1) return `Due in ${hours}h ${mins}m`;
  return `Due in ${mins}m`;
}

export function slaRemaining(deadline: string | null, paused: boolean): string {
  if (!deadline) return '—';
  if (paused) return 'Paused';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Overdue';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
  return `${hours}h ${mins}m left`;
}

export function isOverdue(
  respondBy: string | null,
  resolveBy: string | null,
  firstResponseAt: string | null,
  resolvedAt: string | null,
  slaClock: string,
): boolean {
  if (slaClock === 'pause' || slaClock === 'stop') return false;
  const now = Date.now();
  if (!firstResponseAt && respondBy && now > new Date(respondBy).getTime()) return true;
  if (!resolvedAt && resolveBy && now > new Date(resolveBy).getTime()) return true;
  return false;
}
