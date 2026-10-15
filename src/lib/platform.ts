import { getDb } from './db';
import {
  DEFAULT_ACCOUNT_SETTINGS,
  DEFAULT_SECURITY_SETTINGS,
  PRIVILEGES,
  ROLE_CATALOGUE,
  type PrivilegeKey,
} from './privileges';
import { writeAudit } from './audit';
import { logEvent } from './observability';

function nowIso() {
  return new Date().toISOString();
}

export function ensurePlatformExtras() {
  const db = getDb();
  const messageCols = db.prepare('PRAGMA table_info(messages)').all() as { name: string }[];
  if (!messageCols.some((c) => c.name === 'body_html')) {
    db.exec('ALTER TABLE messages ADD COLUMN body_html TEXT');
  }
  for (const [k, v] of Object.entries(DEFAULT_ACCOUNT_SETTINGS)) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(`account.${k}`, v);
  }
  for (const [k, v] of Object.entries(DEFAULT_SECURITY_SETTINGS)) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(`security.${k}`, v);
  }
  const insertPriv = db.prepare(
    'INSERT OR IGNORE INTO privileges (key, description) VALUES (?, ?)',
  );
  for (const p of PRIVILEGES) insertPriv.run(p.key, p.description);

  const insertRole = db.prepare(
    'INSERT OR IGNORE INTO roles (name, level) VALUES (?, ?)',
  );
  const insertRp = db.prepare(
    'INSERT OR IGNORE INTO role_privileges (role_name, privilege_key) VALUES (?, ?)',
  );
  for (const role of ROLE_CATALOGUE) {
    insertRole.run(role.name, role.level);
    for (const priv of role.privileges) {
      insertRp.run(role.name, priv);
    }
  }

  const deptCount = (db.prepare('SELECT COUNT(*) as c FROM departments').get() as { c: number }).c;
  if (deptCount === 0) {
    const insertDept = db.prepare(
      'INSERT INTO departments (name, approver_email) VALUES (?, ?)',
    );
    insertDept.run('Engineering', 'supervisor@moglix.com');
    insertDept.run('Finance', 'supervisor@moglix.com');
    insertDept.run('Supply Chain', 'agent@moglix.com');
    insertDept.run('Customer Care', 'agent@moglix.com');
  }

  const mbCount = (db.prepare('SELECT COUNT(*) as c FROM mailboxes').get() as { c: number }).c;
  if (mbCount === 0) {
    const insertMb = db.prepare(
      'INSERT INTO mailboxes (name, address, forward_to, group_name, is_primary) VALUES (?, ?, ?, ?, ?)',
    );
    insertMb.run(
      'Moglix Support',
      'techsupport@moglix.com',
      'techsupport@moglilabs.local',
      'Tech Support Team',
      1,
    );
    insertMb.run('Customer Care', 'customercare@moglix.com', 'cc@moglilabs.local', 'Customer Care', 0);
    insertMb.run('Invoice North', 'invoice.north@moglix.com', 'inv-n@moglilabs.local', 'Invoice North', 0);
  }
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string, actorId?: number) {
  getDb()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(key, value);
  if (actorId) writeAudit('settings', 0, actorId, 'setting_updated', `${key}=${value}`);
  logEvent('info', 'setting_updated', { key });
}

export function listSettingsByPrefix(prefix: string): Record<string, string> {
  const rows = getDb()
    .prepare('SELECT key, value FROM settings WHERE key LIKE ?')
    .all(`${prefix}%`) as { key: string; value: string }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key.replace(prefix, '')] = r.value;
  return out;
}

export function privilegesForRoleLevel(level: string): PrivilegeKey[] {
  const role = ROLE_CATALOGUE.find((r) => r.level === level && ['Requester', 'Agent', 'Supervisor', 'Admin'].includes(r.name));
  return role?.privileges ?? [];
}

export function userHasPrivilege(role: string, privilege: PrivilegeKey): boolean {
  const privs = privilegesForRoleLevel(role);
  return privs.includes(privilege);
}

export function listAgents() {
  return getDb()
    .prepare(
      `SELECT id, email, name, role, group_name, department, active
       FROM users WHERE role IN ('agent','supervisor','admin') ORDER BY name`,
    )
    .all() as Record<string, unknown>[];
}

export function listRequesters() {
  return getDb()
    .prepare(
      `SELECT id, email, name, role, department, active FROM users WHERE role = 'requester' ORDER BY name`,
    )
    .all() as Record<string, unknown>[];
}

export function listGroups() {
  return getDb()
    .prepare('SELECT id, name, mailbox, auto_assign FROM groups ORDER BY name')
    .all() as Record<string, unknown>[];
}

export function listDepartments() {
  return getDb()
    .prepare('SELECT id, name, approver_email FROM departments ORDER BY name')
    .all() as Record<string, unknown>[];
}

export function listMailboxes() {
  return getDb()
    .prepare(
      'SELECT id, name, address, forward_to, group_name, is_primary FROM mailboxes ORDER BY is_primary DESC, name',
    )
    .all() as Record<string, unknown>[];
}

export function listRolesWithPrivileges() {
  const db = getDb();
  const roles = db.prepare('SELECT name, level FROM roles ORDER BY level, name').all() as {
    name: string;
    level: string;
  }[];
  if (roles.length === 0) {
    return ROLE_CATALOGUE.map((r) => ({
      name: r.name,
      level: r.level,
      privileges: r.privileges,
    }));
  }
  const privStmt = db.prepare(
    'SELECT privilege_key FROM role_privileges WHERE role_name = ? ORDER BY privilege_key',
  );
  return roles.map((r) => ({
    name: r.name,
    level: r.level,
    privileges: (privStmt.all(r.name) as { privilege_key: string }[]).map((p) => p.privilege_key),
  }));
}

export function createDirectoryUser(input: {
  email: string;
  name: string;
  role: 'agent' | 'supervisor' | 'admin' | 'requester';
  groupName?: string | null;
  department?: string | null;
  actorId: number;
}) {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!name) throw new Error('NAME_REQUIRED');
  if (!email.includes('@')) throw new Error('INVALID_EMAIL');
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) throw new Error('EMAIL_EXISTS');
  const groupName =
    input.role === 'requester' ? null : (input.groupName?.trim() || null);
  const department = input.department?.trim() || null;
  const result = db
    .prepare(
      `INSERT INTO users (email, name, role, group_name, department, active)
       VALUES (?, ?, ?, ?, ?, 1)`,
    )
    .run(email, name, input.role, groupName, department);
  writeAudit('user', Number(result.lastInsertRowid), input.actorId, 'user_created', email);
  logEvent('info', 'user_created', { email, role: input.role });
  return Number(result.lastInsertRowid);
}

export function setUserActive(userId: number, active: boolean, actorId: number) {
  getDb()
    .prepare('UPDATE users SET active = ? WHERE id = ?')
    .run(active ? 1 : 0, userId);
  writeAudit('user', userId, actorId, active ? 'user_activated' : 'user_deactivated');
}

export function createGroup(input: {
  name: string;
  mailbox?: string | null;
  autoAssign?: boolean;
  actorId: number;
}) {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new Error('NAME_REQUIRED');
  const existing = db.prepare('SELECT id FROM groups WHERE name = ?').get(name);
  if (existing) throw new Error('NAME_EXISTS');
  const result = db
    .prepare('INSERT INTO groups (name, mailbox, auto_assign) VALUES (?, ?, ?)')
    .run(name, input.mailbox?.trim() || null, input.autoAssign ? 1 : 0);
  writeAudit('group', Number(result.lastInsertRowid), input.actorId, 'group_created', name);
  return Number(result.lastInsertRowid);
}

export function createDepartment(input: {
  name: string;
  approverEmail?: string | null;
  actorId: number;
}) {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new Error('NAME_REQUIRED');
  const existing = db.prepare('SELECT id FROM departments WHERE name = ?').get(name);
  if (existing) throw new Error('NAME_EXISTS');
  const result = db
    .prepare('INSERT INTO departments (name, approver_email) VALUES (?, ?)')
    .run(name, input.approverEmail?.trim() || null);
  writeAudit('department', Number(result.lastInsertRowid), input.actorId, 'department_created', name);
  return Number(result.lastInsertRowid);
}

export function createMailbox(input: {
  name: string;
  address: string;
  forwardTo?: string | null;
  groupName?: string | null;
  isPrimary?: boolean;
  actorId: number;
}) {
  const db = getDb();
  const name = input.name.trim();
  const address = input.address.trim().toLowerCase();
  if (!name) throw new Error('NAME_REQUIRED');
  if (!address.includes('@')) throw new Error('INVALID_EMAIL');
  const existing = db.prepare('SELECT id FROM mailboxes WHERE address = ?').get(address);
  if (existing) throw new Error('EMAIL_EXISTS');
  if (input.isPrimary) {
    db.prepare('UPDATE mailboxes SET is_primary = 0').run();
  }
  const result = db
    .prepare(
      `INSERT INTO mailboxes (name, address, forward_to, group_name, is_primary)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      name,
      address,
      input.forwardTo?.trim() || null,
      input.groupName?.trim() || null,
      input.isPrimary ? 1 : 0,
    );
  writeAudit('mailbox', Number(result.lastInsertRowid), input.actorId, 'mailbox_created', address);
  return Number(result.lastInsertRowid);
}

export function createRole(input: {
  name: string;
  level: 'requester' | 'agent' | 'supervisor' | 'admin';
  privileges: string[];
  actorId: number;
}) {
  const db = getDb();
  const name = input.name.trim();
  if (!name) throw new Error('NAME_REQUIRED');
  const existing = db.prepare('SELECT name FROM roles WHERE name = ?').get(name);
  if (existing) throw new Error('NAME_EXISTS');
  const validPrivs = new Set(PRIVILEGES.map((p) => p.key));
  const privs = input.privileges.filter((p) => validPrivs.has(p as PrivilegeKey));
  db.prepare('INSERT INTO roles (name, level) VALUES (?, ?)').run(name, input.level);
  const insertRp = db.prepare(
    'INSERT INTO role_privileges (role_name, privilege_key) VALUES (?, ?)',
  );
  for (const p of privs) insertRp.run(name, p);
  writeAudit('role', 0, input.actorId, 'role_created', name);
  return name;
}

export function createSession(userId: number): string {
  const token = `sess_${userId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const lifetimeHrs = Number(getSetting('security.session_lifetime_hours') ?? 12);
  const expires = new Date(Date.now() + lifetimeHrs * 3600_000).toISOString();
  getDb()
    .prepare(
      'INSERT INTO sessions (token, user_id, created_at, expires_at, revoked) VALUES (?, ?, ?, ?, 0)',
    )
    .run(token, userId, nowIso(), expires);
  return token;
}

export function revokeSession(token: string, actorId?: number) {
  getDb().prepare('UPDATE sessions SET revoked = 1 WHERE token = ?').run(token);
  if (actorId) writeAudit('session', 0, actorId, 'session_revoked', token.slice(0, 16));
  logEvent('info', 'session_revoked', { token_prefix: token.slice(0, 12) });
}

export function revokeAllSessionsForUser(userId: number, actorId?: number) {
  getDb().prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ? AND revoked = 0').run(userId);
  if (actorId) writeAudit('session', userId, actorId, 'sessions_force_logout');
}

export function isSessionValid(token: string): boolean {
  const row = getDb()
    .prepare('SELECT revoked, expires_at FROM sessions WHERE token = ?')
    .get(token) as { revoked: number; expires_at: string } | undefined;
  if (!row || row.revoked) return false;
  return new Date(row.expires_at).getTime() > Date.now();
}

export function notifyUser(input: {
  userId: number;
  title: string;
  body: string;
  ticketId?: number;
}) {
  getDb()
    .prepare(
      'INSERT INTO notifications (user_id, ticket_id, title, body, read, created_at) VALUES (?, ?, ?, ?, 0, ?)',
    )
    .run(input.userId, input.ticketId ?? null, input.title, input.body, nowIso());
}

export function listNotifications(userId: number, unreadOnly = false) {
  let sql =
    'SELECT * FROM notifications WHERE user_id = ?';
  if (unreadOnly) sql += ' AND read = 0';
  sql += ' ORDER BY id DESC LIMIT 50';
  return getDb().prepare(sql).all(userId) as Record<string, unknown>[];
}

export function markNotificationRead(id: number, userId: number) {
  getDb()
    .prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
    .run(id, userId);
}

export function markAllNotificationsRead(userId: number) {
  getDb().prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(userId);
}

export function watchTicket(ticketId: number, userId: number) {
  getDb()
    .prepare('INSERT OR IGNORE INTO ticket_watchers (ticket_id, user_id, created_at) VALUES (?, ?, ?)')
    .run(ticketId, userId, nowIso());
  writeAudit('ticket', ticketId, userId, 'watched');
}

export function unwatchTicket(ticketId: number, userId: number) {
  getDb()
    .prepare('DELETE FROM ticket_watchers WHERE ticket_id = ? AND user_id = ?')
    .run(ticketId, userId);
  writeAudit('ticket', ticketId, userId, 'unwatched');
}

export function isWatching(ticketId: number, userId: number): boolean {
  return !!getDb()
    .prepare('SELECT 1 FROM ticket_watchers WHERE ticket_id = ? AND user_id = ?')
    .get(ticketId, userId);
}

export function listWatchers(ticketId: number): number[] {
  const rows = getDb()
    .prepare('SELECT user_id FROM ticket_watchers WHERE ticket_id = ?')
    .all(ticketId) as { user_id: number }[];
  return rows.map((r) => r.user_id);
}

export function listWatcherUsers(ticketId: number) {
  return getDb()
    .prepare(
      `SELECT u.id, u.name, u.email
       FROM ticket_watchers w
       JOIN users u ON u.id = w.user_id
       WHERE w.ticket_id = ?
       ORDER BY u.name`,
    )
    .all(ticketId) as { id: number; name: string; email: string }[];
}

/** In-app alerts for ticket watchers (excludes actor). */
export function notifyWatchers(input: {
  ticketId: number;
  title: string;
  body: string;
  excludeUserId?: number;
}) {
  for (const watcherId of listWatchers(input.ticketId)) {
    if (input.excludeUserId != null && watcherId === input.excludeUserId) continue;
    notifyUser({
      userId: watcherId,
      title: input.title,
      body: input.body,
      ticketId: input.ticketId,
    });
  }
}

export function quarantineSpam(input: {
  fromAddr: string;
  subject: string;
  reason: string;
  rawPreview?: string;
}) {
  getDb()
    .prepare(
      'INSERT INTO spam_quarantine (from_addr, subject, reason, raw_preview, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(input.fromAddr, input.subject, input.reason, input.rawPreview ?? null, nowIso());
  logEvent('warn', 'spam_quarantined', { from: input.fromAddr, reason: input.reason });
}

export function listSpamQuarantine(limit = 50) {
  return getDb()
    .prepare('SELECT * FROM spam_quarantine ORDER BY id DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
}

export function getSpamQuarantineById(id: number) {
  return getDb().prepare('SELECT * FROM spam_quarantine WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
}

export function deleteSpamQuarantine(id: number) {
  getDb().prepare('DELETE FROM spam_quarantine WHERE id = ?').run(id);
}

export function isNotificationEventEnabled(event: string): boolean {
  const raw = getSetting(`notify.${event}`);
  if (raw == null) return true;
  return raw !== '0' && raw.toLowerCase() !== 'false';
}

export function setNotificationEventEnabled(event: string, enabled: boolean, actorId?: number) {
  setSetting(`notify.${event}`, enabled ? '1' : '0', actorId);
}

export function isAllowedSenderDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const allowed = (getSetting('security.allowed_email_domains') ?? 'moglix.com')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(domain);
}
