/**
 * Ticket edit locks / collision detection.
 * Pattern: osTicket Lock (expire + renew) — reimplemented for SQLite.
 * Soft presence is out of scope; hard lock with TTL is enough for the pilot.
 * @see OSS-DEV-REFERENCE.md
 */
import { getDb } from './db';
import { writeAudit } from './audit';

function nowIso() {
  return new Date().toISOString();
}

function lockCode() {
  return `lk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type TicketLock = {
  ticket_id: number;
  user_id: number;
  code: string;
  expires_at: string;
  created_at: string;
  user_name?: string;
};

export function ensureTicketLocks() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS ticket_locks (
      ticket_id INTEGER PRIMARY KEY REFERENCES tickets(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function getActiveLock(ticketId: number): TicketLock | null {
  const row = getDb()
    .prepare(
      `SELECT l.*, u.name as user_name
       FROM ticket_locks l
       JOIN users u ON u.id = l.user_id
       WHERE l.ticket_id = ?`,
    )
    .get(ticketId) as TicketLock | undefined;
  if (!row) return null;
  if (isExpired(row.expires_at)) {
    getDb().prepare('DELETE FROM ticket_locks WHERE ticket_id = ?').run(ticketId);
    return null;
  }
  return row;
}

/** Acquire or renew a lock. Returns lock or null if held by another agent. */
export function acquireTicketLock(
  ticketId: number,
  userId: number,
  minutes = 5,
): { lock: TicketLock; acquired: boolean } | { lock: TicketLock; acquired: false; blocked: true } {
  const existing = getActiveLock(ticketId);
  const expires = new Date(Date.now() + minutes * 60_000).toISOString();
  if (existing && existing.user_id !== userId) {
    return { lock: existing, acquired: false, blocked: true };
  }
  const code = existing?.user_id === userId ? existing.code : lockCode();
  getDb()
    .prepare(
      `INSERT INTO ticket_locks (ticket_id, user_id, code, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(ticket_id) DO UPDATE SET
         user_id = excluded.user_id,
         code = excluded.code,
         expires_at = excluded.expires_at`,
    )
    .run(ticketId, userId, code, expires, existing?.created_at ?? nowIso());
  if (!existing) writeAudit('ticket', ticketId, userId, 'lock_acquired');
  const lock = getActiveLock(ticketId)!;
  return { lock, acquired: true };
}

export function renewTicketLock(ticketId: number, userId: number, minutes = 5): boolean {
  const existing = getActiveLock(ticketId);
  if (!existing || existing.user_id !== userId) return false;
  const expires = new Date(Date.now() + minutes * 60_000).toISOString();
  getDb()
    .prepare('UPDATE ticket_locks SET expires_at = ? WHERE ticket_id = ? AND user_id = ?')
    .run(expires, ticketId, userId);
  return true;
}

export function releaseTicketLock(ticketId: number, userId: number): boolean {
  const result = getDb()
    .prepare('DELETE FROM ticket_locks WHERE ticket_id = ? AND user_id = ?')
    .run(ticketId, userId);
  if (result.changes > 0) writeAudit('ticket', ticketId, userId, 'lock_released');
  return result.changes > 0;
}

export function cleanupExpiredLocks() {
  getDb().prepare(`DELETE FROM ticket_locks WHERE expires_at < ?`).run(nowIso());
}
