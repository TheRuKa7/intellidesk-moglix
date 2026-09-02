import {
  ALL_SUPPORT_TEAMS,
  DEMO_USERS,
  PILOT_GROUP,
  PILOT_MAILBOX,
  PORTAL_SUPPORT_TEAMS,
  STATUSES,
  TICKET_COUNTER_START,
} from './constants';
import { getDb } from './db';
import { computeSlaDeadlines } from './sla';

export function isSeeded(): boolean {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get('seeded') as
    | { value: string }
    | undefined;
  return row?.value === 'true';
}

function seedDemoTicket(db: ReturnType<typeof getDb>) {
  const exists = db.prepare("SELECT 1 FROM tickets WHERE display_number = 'INC-2176596'").get();
  if (exists) return;

  const requester = db
    .prepare("SELECT id FROM users WHERE email = 'employee@moglix.com'")
    .get() as { id: number };
  const openStatus = db.prepare("SELECT id FROM statuses WHERE name = 'Open'").get() as { id: number };
  const createdAt = new Date();
  const { respondBy, resolveBy } = computeSlaDeadlines(createdAt, 'Tech Support Team');

  db.prepare(
    `INSERT INTO tickets (
      number, display_number, subject, description, status_id, group_name, support_team,
      requester_id, priority, source, mailbox, respond_by, resolve_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Low', 'portal', ?, ?, ?, ?, ?)`,
  ).run(
    TICKET_COUNTER_START,
    `INC-${TICKET_COUNTER_START}`,
    'VPN not connecting (demo)',
    'Cannot access internal tools from home. Demo ticket for mail threading.',
    openStatus.id,
    PILOT_GROUP,
    'Tech Support Team',
    requester.id,
    PILOT_MAILBOX,
    respondBy,
    resolveBy,
    createdAt.toISOString(),
    createdAt.toISOString(),
  );

  db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(
    String(TICKET_COUNTER_START + 1),
    'ticket_counter',
  );
}

export function seedDatabase() {
  const db = getDb();
  if (isSeeded()) {
    seedDemoTicket(db);
    return;
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'ticket_counter',
      String(TICKET_COUNTER_START + 1),
    );
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded', 'true');

    const insertUser = db.prepare(
      'INSERT INTO users (email, name, role, group_name) VALUES (?, ?, ?, ?)',
    );
    for (const u of DEMO_USERS) {
      insertUser.run(u.email, u.name, u.role, u.group);
    }

    const insertGroup = db.prepare(
      'INSERT INTO groups (name, mailbox, auto_assign) VALUES (?, ?, ?)',
    );
    insertGroup.run(PILOT_GROUP, PILOT_MAILBOX, 1);
    insertGroup.run('Customer Care', 'customercare@moglix.com', 0);
    insertGroup.run('Invoice North', 'invoice.north@moglix.com', 0);

    const insertStatus = db.prepare(
      'INSERT INTO statuses (name, category, sla_clock) VALUES (?, ?, ?)',
    );
    for (const s of STATUSES) {
      insertStatus.run(s.name, s.category, s.slaClock);
    }

    const insertTeam = db.prepare(
      'INSERT INTO support_teams (name, portal_visible) VALUES (?, ?)',
    );
    const portalSet = new Set<string>(PORTAL_SUPPORT_TEAMS);
    for (const team of ALL_SUPPORT_TEAMS) {
      insertTeam.run(team, portalSet.has(team) ? 1 : 0);
    }

    seedDemoTicket(db);

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
