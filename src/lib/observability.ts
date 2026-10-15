/**
 * Prototype observability — structured events + counters in SQLite.
 * Production: OpenTelemetry / Sentry.
 */
import { getDb } from './db';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function nowIso() {
  return new Date().toISOString();
}

export function logEvent(
  level: LogLevel,
  event: string,
  detail?: Record<string, unknown>,
) {
  const db = getDb();
  db.prepare(
    'INSERT INTO platform_events (level, event, detail, created_at) VALUES (?, ?, ?, ?)',
  ).run(level, event, detail ? JSON.stringify(detail) : null, nowIso());
  if (level === 'error' || level === 'warn') {
    console[level === 'error' ? 'error' : 'warn'](`[${event}]`, detail ?? '');
  }
}

export function incrementMetric(name: string, by = 1) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM metrics WHERE name = ?').get(name) as
    | { value: number }
    | undefined;
  if (row) {
    db.prepare('UPDATE metrics SET value = value + ?, updated_at = ? WHERE name = ?').run(
      by,
      nowIso(),
      name,
    );
  } else {
    db.prepare('INSERT INTO metrics (name, value, updated_at) VALUES (?, ?, ?)').run(
      name,
      by,
      nowIso(),
    );
  }
}

export function getMetrics(): { name: string; value: number; updated_at: string }[] {
  return getDb()
    .prepare('SELECT name, value, updated_at FROM metrics ORDER BY name')
    .all() as { name: string; value: number; updated_at: string }[];
}

export function getRecentEvents(limit = 50) {
  return getDb()
    .prepare('SELECT * FROM platform_events ORDER BY id DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
}
