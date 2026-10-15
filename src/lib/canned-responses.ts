/**
 * Canned responses / text modules.
 * Pattern: osTicket canned replies + Zammad text modules (reimplemented).
 * Templating via Handlebars (MIT) — already used for lifecycle mail.
 * @see OSS-DEV-REFERENCE.md
 */
import Handlebars from 'handlebars';
import { getDb } from './db';
import { writeAudit } from './audit';

function nowIso() {
  return new Date().toISOString();
}

export type CannedResponse = {
  id: number;
  title: string;
  shortcut: string | null;
  body: string;
  group_name: string | null;
  is_active: number;
};

const SEED_CANNED: { title: string; shortcut: string; body: string }[] = [
  {
    title: 'VPN troubleshooting',
    shortcut: 'vpn',
    body: `Hi {{requesterName}},

Thanks for reporting {{displayNumber}}. Please try:
1. Disconnect and reconnect the VPN client
2. Confirm you are on the corporate network profile
3. Reply with any error codes you see

— {{agentName}}`,
  },
  {
    title: 'Awaiting more info',
    shortcut: 'info',
    body: `Hi {{requesterName}},

We need a bit more detail on {{displayNumber}} ({{subject}}) before we can proceed. Please reply with screenshots or exact steps to reproduce.

— {{agentName}}`,
  },
  {
    title: 'Resolved confirmation',
    shortcut: 'done',
    body: `Hi {{requesterName}},

We've completed work on {{displayNumber}}. If anything still looks wrong, reply to this ticket and we will reopen it.

— {{agentName}}`,
  },
];

export function ensureCannedResponses() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS canned_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      shortcut TEXT,
      body TEXT NOT NULL,
      group_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER,
      updated_at TEXT NOT NULL
    );
  `);
  const count = (db.prepare('SELECT COUNT(*) as c FROM canned_responses').get() as { c: number }).c;
  if (count === 0) {
    const insert = db.prepare(
      'INSERT INTO canned_responses (title, shortcut, body, group_name, is_active, updated_at) VALUES (?, ?, ?, NULL, 1, ?)',
    );
    for (const row of SEED_CANNED) {
      insert.run(row.title, row.shortcut, row.body, nowIso());
    }
  }
}

export function listCannedResponses(groupName?: string | null): CannedResponse[] {
  const db = getDb();
  if (groupName) {
    return db
      .prepare(
        `SELECT * FROM canned_responses
         WHERE is_active = 1 AND (group_name IS NULL OR group_name = ?)
         ORDER BY title`,
      )
      .all(groupName) as CannedResponse[];
  }
  return db
    .prepare('SELECT * FROM canned_responses WHERE is_active = 1 ORDER BY title')
    .all() as CannedResponse[];
}

export function getCannedResponse(id: number): CannedResponse | undefined {
  return getDb().prepare('SELECT * FROM canned_responses WHERE id = ?').get(id) as
    | CannedResponse
    | undefined;
}

export function renderCannedResponse(
  canned: CannedResponse,
  context: Record<string, unknown>,
): string {
  return Handlebars.compile(canned.body)(context);
}

export function applyCannedResponse(input: {
  cannedId: number;
  displayNumber: string;
  subject: string;
  requesterName: string;
  agentName: string;
}): string | null {
  const canned = getCannedResponse(input.cannedId);
  if (!canned || !canned.is_active) return null;
  return renderCannedResponse(canned, {
    displayNumber: input.displayNumber,
    subject: input.subject,
    requesterName: input.requesterName,
    agentName: input.agentName,
  });
}

export function createCannedResponse(input: {
  title: string;
  body: string;
  shortcut?: string;
  actorId: number;
  groupName?: string;
}) {
  const result = getDb()
    .prepare(
      'INSERT INTO canned_responses (title, shortcut, body, group_name, is_active, created_by, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
    )
    .run(
      input.title,
      input.shortcut ?? null,
      input.body,
      input.groupName ?? null,
      input.actorId,
      nowIso(),
    );
  writeAudit('canned', Number(result.lastInsertRowid), input.actorId, 'created', input.title);
  return Number(result.lastInsertRowid);
}
