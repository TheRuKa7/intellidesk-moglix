/**
 * Ticket relations: merge, related links, tags.
 * Patterns: Zammad merge_to / Link, RT EffectiveId, Zammad tags — reimplemented.
 * @see OSS-DEV-REFERENCE.md
 */
import { getDb } from './db';
import { writeAudit } from './audit';

function nowIso() {
  return new Date().toISOString();
}

function notifyWatchersLocal(input: {
  ticketId: number;
  title: string;
  body: string;
  excludeUserId?: number;
}) {
  const rows = getDb()
    .prepare('SELECT user_id FROM ticket_watchers WHERE ticket_id = ?')
    .all(input.ticketId) as { user_id: number }[];
  const insert = getDb().prepare(
    'INSERT INTO notifications (user_id, ticket_id, title, body, read, created_at) VALUES (?, ?, ?, ?, 0, ?)',
  );
  const ts = nowIso();
  for (const row of rows) {
    if (input.excludeUserId != null && row.user_id === input.excludeUserId) continue;
    insert.run(row.user_id, input.ticketId, input.title, input.body, ts);
  }
}

export type LinkType = 'merged_into' | 'related' | 'parent';

export function ensureTicketRelations() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES tickets(id),
      target_id INTEGER NOT NULL REFERENCES tickets(id),
      type TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT NOT NULL,
      UNIQUE(source_id, target_id, type)
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
    CREATE TABLE IF NOT EXISTS ticket_tags (
      ticket_id INTEGER NOT NULL REFERENCES tickets(id),
      tag_id INTEGER NOT NULL REFERENCES tags(id),
      PRIMARY KEY (ticket_id, tag_id)
    );
  `);
  const cols = db.prepare('PRAGMA table_info(tickets)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'merged_into_id')) {
    db.exec('ALTER TABLE tickets ADD COLUMN merged_into_id INTEGER');
  }
  db.prepare(
    "INSERT OR IGNORE INTO statuses (name, category, sla_clock) VALUES ('Merged', 'done', 'stop')",
  ).run();
}

export function resolveEffectiveTicketId(ticketId: number): number {
  const db = getDb();
  let id = ticketId;
  for (let i = 0; i < 10; i += 1) {
    const row = db
      .prepare('SELECT merged_into_id FROM tickets WHERE id = ?')
      .get(id) as { merged_into_id: number | null } | undefined;
    if (!row?.merged_into_id) return id;
    id = row.merged_into_id;
  }
  return id;
}

export function linkTickets(input: {
  sourceId: number;
  targetId: number;
  type: LinkType;
  actorId: number;
}) {
  if (input.sourceId === input.targetId) throw new Error('SELF_LINK');
  getDb()
    .prepare(
      'INSERT OR IGNORE INTO ticket_links (source_id, target_id, type, created_by, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(input.sourceId, input.targetId, input.type, input.actorId, nowIso());
  writeAudit('ticket', input.sourceId, input.actorId, 'linked', `${input.type}:${input.targetId}`);
}

export function listLinkedTickets(ticketId: number) {
  return getDb()
    .prepare(
      `SELECT l.type, l.source_id, l.target_id,
              CASE WHEN l.source_id = ? THEN t2.id ELSE t1.id END as other_id,
              CASE WHEN l.source_id = ? THEN t2.display_number ELSE t1.display_number END as other_display,
              CASE WHEN l.source_id = ? THEN t2.subject ELSE t1.subject END as other_subject
       FROM ticket_links l
       JOIN tickets t1 ON t1.id = l.source_id
       JOIN tickets t2 ON t2.id = l.target_id
       WHERE l.source_id = ? OR l.target_id = ?
       ORDER BY l.id DESC`,
    )
    .all(ticketId, ticketId, ticketId, ticketId, ticketId) as {
    type: string;
    other_id: number;
    other_display: string;
    other_subject: string;
  }[];
}

export function unlinkTickets(sourceId: number, targetId: number, type: LinkType, actorId: number) {
  getDb()
    .prepare(
      'DELETE FROM ticket_links WHERE type = ? AND ((source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?))',
    )
    .run(type, sourceId, targetId, targetId, sourceId);
  writeAudit('ticket', sourceId, actorId, 'unlinked', `${type}:${targetId}`);
}

/** Merge source into target (Zammad/RT pattern). Returns target id. */
export function mergeTickets(input: {
  sourceId: number;
  targetId: number;
  actorId: number;
}): number {
  const db = getDb();
  if (input.sourceId === input.targetId) throw new Error('SELF_MERGE');

  const source = db
    .prepare('SELECT id, display_number, subject, merged_into_id, deleted FROM tickets WHERE id = ?')
    .get(input.sourceId) as
    | {
        id: number;
        display_number: string;
        subject: string;
        merged_into_id: number | null;
        deleted: number;
      }
    | undefined;
  const target = db
    .prepare('SELECT id, display_number, subject, merged_into_id, deleted FROM tickets WHERE id = ?')
    .get(input.targetId) as
    | {
        id: number;
        display_number: string;
        subject: string;
        merged_into_id: number | null;
        deleted: number;
      }
    | undefined;

  if (!source || !target) throw new Error('NOT_FOUND');
  if (source.deleted || target.deleted) throw new Error('DELETED');
  if (source.merged_into_id) throw new Error('ALREADY_MERGED');
  const effectiveTarget = resolveEffectiveTicketId(input.targetId);
  if (effectiveTarget === input.sourceId) throw new Error('CYCLE');

  const mergedStatus = db
    .prepare("SELECT id FROM statuses WHERE name = 'Merged'")
    .get() as { id: number } | undefined;
  if (!mergedStatus) throw new Error('MERGED_STATUS_MISSING');

  const ts = nowIso();
  const moveMessages = db.prepare('UPDATE messages SET ticket_id = ? WHERE ticket_id = ?');
  const moveAttach = db.prepare('UPDATE attachments SET ticket_id = ? WHERE ticket_id = ?');
  const moveWatchers = db.prepare(
    `INSERT OR IGNORE INTO ticket_watchers (ticket_id, user_id, created_at)
     SELECT ?, user_id, ? FROM ticket_watchers WHERE ticket_id = ?`,
  );
  const clearWatchers = db.prepare('DELETE FROM ticket_watchers WHERE ticket_id = ?');
  const moveTags = db.prepare(
    `INSERT OR IGNORE INTO ticket_tags (ticket_id, tag_id)
     SELECT ?, tag_id FROM ticket_tags WHERE ticket_id = ?`,
  );
  const clearTags = db.prepare('DELETE FROM ticket_tags WHERE ticket_id = ?');

  const note = db.prepare(
    'INSERT INTO messages (ticket_id, author_id, body, type, created_at) VALUES (?, ?, ?, ?, ?)',
  );

  db.exec('BEGIN');
  try {
    moveMessages.run(effectiveTarget, input.sourceId);
    moveAttach.run(effectiveTarget, input.sourceId);
    moveWatchers.run(effectiveTarget, ts, input.sourceId);
    clearWatchers.run(input.sourceId);
    moveTags.run(effectiveTarget, input.sourceId);
    clearTags.run(input.sourceId);

    db.prepare(
      'UPDATE tickets SET status_id = ?, merged_into_id = ?, assignee_id = NULL, updated_at = ? WHERE id = ?',
    ).run(mergedStatus.id, effectiveTarget, ts, input.sourceId);

    db.prepare(
      'INSERT OR IGNORE INTO ticket_links (source_id, target_id, type, created_by, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(input.sourceId, effectiveTarget, 'merged_into', input.actorId, ts);

    note.run(
      effectiveTarget,
      input.actorId,
      `Merged ticket ${source.display_number} ("${source.subject}") into this ticket.`,
      'note',
      ts,
    );
    note.run(
      input.sourceId,
      input.actorId,
      `This ticket was merged into ${
        (
          db.prepare('SELECT display_number FROM tickets WHERE id = ?').get(effectiveTarget) as {
            display_number: string;
          }
        ).display_number
      }.`,
      'note',
      ts,
    );
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  writeAudit('ticket', input.sourceId, input.actorId, 'merged_into', String(effectiveTarget));
  writeAudit('ticket', effectiveTarget, input.actorId, 'merged_from', String(input.sourceId));
  notifyWatchersLocal({
    ticketId: effectiveTarget,
    title: `${target.display_number} received a merge`,
    body: `${source.display_number} was merged in`,
    excludeUserId: input.actorId,
  });
  return effectiveTarget;
}

export function listTicketTags(ticketId: number): { id: number; name: string }[] {
  return getDb()
    .prepare(
      `SELECT t.id, t.name FROM tags t
       JOIN ticket_tags tt ON tt.tag_id = t.id
       WHERE tt.ticket_id = ?
       ORDER BY t.name`,
    )
    .all(ticketId) as { id: number; name: string }[];
}

export function addTicketTag(ticketId: number, name: string, actorId: number) {
  const cleaned = name.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);
  if (!cleaned) return null;
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(cleaned);
  const tag = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(cleaned) as
    | { id: number }
    | undefined;
  if (!tag) return null;
  db.prepare('INSERT OR IGNORE INTO ticket_tags (ticket_id, tag_id) VALUES (?, ?)').run(
    ticketId,
    tag.id,
  );
  writeAudit('ticket', ticketId, actorId, 'tag_added', cleaned);
  return cleaned;
}

export function removeTicketTag(ticketId: number, tagId: number, actorId: number) {
  getDb().prepare('DELETE FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?').run(ticketId, tagId);
  writeAudit('ticket', ticketId, actorId, 'tag_removed', String(tagId));
}
