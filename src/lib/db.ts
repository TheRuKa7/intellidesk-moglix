import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { seedDatabase } from './seed';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'intellidesk.db');

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  migrate(db);
  seedDatabase();
  return db;
}

function migrate(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      group_name TEXT,
      department TEXT DEFAULT 'Engineering',
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      mailbox TEXT,
      auto_assign INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      sla_clock TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      portal_visible INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL UNIQUE,
      display_number TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      status_id INTEGER NOT NULL REFERENCES statuses(id),
      group_name TEXT NOT NULL,
      support_team TEXT NOT NULL,
      requester_id INTEGER NOT NULL REFERENCES users(id),
      assignee_id INTEGER REFERENCES users(id),
      priority TEXT NOT NULL DEFAULT 'Low',
      source TEXT NOT NULL,
      mailbox TEXT,
      cc TEXT,
      custom_fields TEXT NOT NULL DEFAULT '{}',
      resolution_note TEXT,
      sla_breached INTEGER NOT NULL DEFAULT 0,
      respond_by TEXT,
      resolve_by TEXT,
      first_response_at TEXT,
      resolved_at TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id),
      author_id INTEGER REFERENCES users(id),
      body TEXT NOT NULL,
      type TEXT NOT NULL,
      email_message_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mail_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id),
      to_addr TEXT NOT NULL,
      cc_addr TEXT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      event TEXT NOT NULL,
      sent_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      actor_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_group ON tickets(group_name);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status_id);
    CREATE INDEX IF NOT EXISTS idx_messages_ticket ON messages(ticket_id);

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id),
      filename TEXT NOT NULL,
      uploaded_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL
    );
  `);

  const columns = database.prepare('PRAGMA table_info(tickets)').all() as { name: string }[];
  const names = new Set(columns.map((c) => c.name));
  if (!names.has('other_remarks')) {
    database.exec('ALTER TABLE tickets ADD COLUMN other_remarks TEXT');
  }
  if (!names.has('breach_reason')) {
    database.exec('ALTER TABLE tickets ADD COLUMN breach_reason TEXT');
  }
}

export type UserRow = {
  id: number;
  email: string;
  name: string;
  role: string;
  group_name: string | null;
  department: string;
};

export type TicketRow = {
  id: number;
  number: number;
  display_number: string;
  subject: string;
  description: string;
  status_id: number;
  group_name: string;
  support_team: string;
  requester_id: number;
  assignee_id: number | null;
  priority: string;
  source: string;
  mailbox: string | null;
  cc: string | null;
  custom_fields: string;
  resolution_note: string | null;
  sla_breached: number;
  respond_by: string | null;
  resolve_by: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};
