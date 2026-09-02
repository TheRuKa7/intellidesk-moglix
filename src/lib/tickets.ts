import { PILOT_GROUP, PILOT_MAILBOX } from './constants';
import { getAuditForTicket, writeAudit } from './audit';
import { getDb } from './db';
import { computeSlaDeadlines, evaluateSlaBreach, shouldAutoClose } from './sla';

function parseCustomFields(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'string') return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function nowIso() {
  return new Date().toISOString();
}

type SqlParam = string | number | bigint | null;

function nextTicketNumber(): { number: number; display: string } {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('ticket_counter') as {
    value: string;
  };
  const number = Number(row.value);
  db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(number + 1), 'ticket_counter');
  return { number, display: `INC-${number}` };
}

function getStatusId(name: string): number {
  const row = getDb().prepare('SELECT id, sla_clock FROM statuses WHERE name = ?').get(name) as
    | { id: number; sla_clock: string }
    | undefined;
  if (!row) throw new Error(`Unknown status: ${name}`);
  return row.id;
}

function getStatusById(id: number) {
  return getDb().prepare('SELECT * FROM statuses WHERE id = ?').get(id) as {
    id: number;
    name: string;
    sla_clock: string;
  };
}

function queueMail(
  ticketId: number,
  to: string,
  subject: string,
  body: string,
  event: string,
  cc?: string,
) {
  getDb()
    .prepare(
      'INSERT INTO mail_outbox (ticket_id, to_addr, cc_addr, subject, body, event, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(ticketId, to, cc ?? null, subject, body, event, nowIso());
}

function notifySlaBreach(ticket: Record<string, unknown>) {
  const db = getDb();
  const assigneeEmail = ticket.assignee_id
    ? (db.prepare('SELECT email FROM users WHERE id = ?').get(ticket.assignee_id as number) as
        | { email: string }
        | undefined)?.email
    : null;
  const to = assigneeEmail ?? (ticket.mailbox as string) ?? PILOT_MAILBOX;
  queueMail(
    ticket.id as number,
    to,
    `SLA breached: [${ticket.display_number}] ${ticket.subject as string}`,
    `Ticket ${ticket.display_number as string} has breached its SLA. Please review and add a breach reason.`,
    'sla_breach',
  );
}

const REOPEN_STATUSES = ['Resolved', 'Interim Resolve', 'Closed'];

function reopenTicket(ticketId: number, supportTeam: string, actorId: number, ts: string) {
  const openId = getStatusId('Re-Open');
  const { respondBy, resolveBy } = computeSlaDeadlines(new Date(), supportTeam);
  getDb()
    .prepare(
      `UPDATE tickets SET status_id = ?, resolved_at = NULL, closed_at = NULL, first_response_at = NULL,
       respond_by = ?, resolve_by = ?, sla_breached = 0, breach_reason = NULL, updated_at = ?
       WHERE id = ?`,
    )
    .run(openId, respondBy, resolveBy, ts, ticketId);
  writeAudit('ticket', ticketId, actorId, 'reopened');
}

export function isPortalVisibleTeam(teamName: string): boolean {
  const row = getDb()
    .prepare('SELECT 1 FROM support_teams WHERE name = ? AND portal_visible = 1')
    .get(teamName);
  return !!row;
}

export function getLatestTicketDisplayNumber(): string | null {
  const row = getDb()
    .prepare('SELECT display_number FROM tickets WHERE deleted = 0 ORDER BY id DESC LIMIT 1')
    .get() as { display_number: string } | undefined;
  return row?.display_number ?? null;
}

export function findOrCreateRequester(email: string, name?: string) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  if (existing) return existing.id;
  const result = db
    .prepare('INSERT INTO users (email, name, role, group_name) VALUES (?, ?, ?, ?)')
    .run(email, name ?? email.split('@')[0], 'requester', null);
  return Number(result.lastInsertRowid);
}

function autoAssignToGroup(ticketId: number, groupName: string) {
  const db = getDb();
  const group = db.prepare('SELECT auto_assign FROM groups WHERE name = ?').get(groupName) as
    | { auto_assign: number }
    | undefined;
  if (!group?.auto_assign) return;

  const agent = db
    .prepare(
      `SELECT u.id FROM users u
       WHERE u.role = 'agent' AND u.active = 1 AND u.group_name = ?
       ORDER BY (
         SELECT COUNT(*) FROM tickets t
         JOIN statuses s ON s.id = t.status_id
         WHERE t.assignee_id = u.id AND s.category != 'done' AND t.deleted = 0
       ) ASC
       LIMIT 1`,
    )
    .get(groupName) as { id: number } | undefined;
  if (!agent) return;

  db.prepare('UPDATE tickets SET assignee_id = ?, updated_at = ? WHERE id = ?').run(
    agent.id,
    nowIso(),
    ticketId,
  );
  const agentUser = db.prepare('SELECT email FROM users WHERE id = ?').get(agent.id) as { email: string };
  queueMail(ticketId, agentUser.email, `Assigned: ticket #${ticketId}`, 'You were auto-assigned this ticket.', 'assigned');
  writeAudit('ticket', ticketId, null, 'auto_assigned', String(agent.id));
}

export function createTicket(input: {
  subject: string;
  description: string;
  supportTeam: string;
  requesterId: number;
  source: 'portal' | 'email';
  mailbox?: string;
  cc?: string;
  otherRemarks?: string;
  actorId?: number;
  groupName?: string;
  attachmentNames?: string[];
}) {
  const db = getDb();
  const createdAt = new Date();
  const { number, display } = nextTicketNumber();
  const groupName = input.groupName ?? (input.supportTeam === 'Tech Support Team' ? PILOT_GROUP : input.supportTeam);
  const mailbox = input.mailbox ?? (groupName === PILOT_GROUP ? PILOT_MAILBOX : null);
  const { respondBy, resolveBy } = computeSlaDeadlines(createdAt, input.supportTeam);
  const statusId = getStatusId('Open');

  const result = db
    .prepare(
      `INSERT INTO tickets (
        number, display_number, subject, description, status_id, group_name, support_team,
        requester_id, priority, source, mailbox, cc, other_remarks, respond_by, resolve_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Low', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      number,
      display,
      input.subject,
      input.description,
      statusId,
      groupName,
      input.supportTeam,
      input.requesterId,
      input.source,
      mailbox,
      input.cc ?? null,
      input.otherRemarks ?? null,
      respondBy,
      resolveBy,
      createdAt.toISOString(),
      createdAt.toISOString(),
    );

  const ticketId = Number(result.lastInsertRowid);
  if (input.attachmentNames?.length) {
    for (const filename of input.attachmentNames) {
      saveAttachment(ticketId, filename, input.requesterId);
    }
  }
  db.prepare(
    'INSERT INTO messages (ticket_id, author_id, body, type, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(ticketId, input.requesterId, input.description, 'public', createdAt.toISOString());

  const requester = db.prepare('SELECT email, name FROM users WHERE id = ?').get(input.requesterId) as {
    email: string;
    name: string;
  };

  queueMail(
    ticketId,
    requester.email,
    `[${display}] ${input.subject}`,
    `We received your request (${display}).\n\n${input.description}`,
    'ticket_created',
    input.cc,
  );
  queueMail(
    ticketId,
    mailbox ?? 'team@moglix.com',
    `[${display}] New ticket for ${groupName}`,
    `New ${input.source} ticket: ${input.subject}`,
    'team_notify',
  );

  writeAudit('ticket', ticketId, input.actorId ?? input.requesterId, 'created', input.source);
  autoAssignToGroup(ticketId, groupName);
  return getTicketById(ticketId);
}

export function saveAttachment(ticketId: number, filename: string, uploadedBy: number) {
  getDb()
    .prepare('INSERT INTO attachments (ticket_id, filename, uploaded_by, created_at) VALUES (?, ?, ?, ?)')
    .run(ticketId, filename, uploadedBy, nowIso());
}

export function getAttachments(ticketId: number) {
  return getDb()
    .prepare('SELECT * FROM attachments WHERE ticket_id = ? ORDER BY created_at ASC')
    .all(ticketId) as Record<string, unknown>[];
}

export function pickupTicket(ticketId: number, agentId: number) {
  return updateTicket({ ticketId, actorId: agentId, assigneeId: agentId });
}

export function getTicketById(id: number) {
  const ticket = getDb().prepare('SELECT * FROM tickets WHERE id = ? AND deleted = 0').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!ticket) return null;
  return enrichTicket(ticket);
}

export function getTicketByNumber(displayNumber: string) {
  const normalized = displayNumber.replace(/\[|\]/g, '').trim();
  const ticket = getDb()
    .prepare('SELECT * FROM tickets WHERE display_number = ? AND deleted = 0')
    .get(normalized.includes('INC-') ? normalized : `INC-${normalized}`) as Record<string, unknown> | undefined;
  if (!ticket) return null;
  return enrichTicket(ticket);
}

function enrichTicket(ticket: Record<string, unknown>) {
  const db = getDb();
  const status = getStatusById(ticket.status_id as number);
  const requester = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(ticket.requester_id as number);
  const assignee = ticket.assignee_id
    ? db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(ticket.assignee_id as number)
    : null;
  const messages = db
    .prepare('SELECT m.*, u.name as author_name FROM messages m LEFT JOIN users u ON u.id = m.author_id WHERE ticket_id = ? ORDER BY created_at ASC')
    .all(ticket.id as number);
  const attachments = db
    .prepare('SELECT * FROM attachments WHERE ticket_id = ? ORDER BY created_at ASC')
    .all(ticket.id as number);
  const breached = evaluateSlaBreach(
    status.sla_clock,
    ticket.respond_by as string | null,
    ticket.resolve_by as string | null,
    ticket.first_response_at as string | null,
    ticket.resolved_at as string | null,
  );
  if (breached && !ticket.sla_breached) {
    db.prepare('UPDATE tickets SET sla_breached = 1, updated_at = ? WHERE id = ?').run(nowIso(), ticket.id as number);
    ticket.sla_breached = 1;
    notifySlaBreach(ticket);
  }
  return { ...ticket, status, requester, assignee, messages, attachments, custom_fields: parseCustomFields(ticket.custom_fields), sla_breached: breached ? 1 : ticket.sla_breached } as unknown as Record<string, unknown> & {
    status: { id: number; name: string; sla_clock: string };
    requester: { id: number; name: string; email: string };
    assignee: { id: number; name: string; email: string } | null;
    messages: Record<string, unknown>[];
    attachments: Record<string, unknown>[];
    custom_fields: Record<string, string>;
  };
}

export function listTickets(filters: {
  groupName?: string;
  requesterId?: number;
  assigneeId?: number;
  statusCategory?: string;
  statusName?: string;
  search?: string;
  overdueOnly?: boolean;
  sortBy?: 'created_at' | 'updated_at' | 'display_number';
  sortDir?: 'asc' | 'desc';
}) {
  let sql = `SELECT t.*, s.name as status_name, s.category as status_category, s.sla_clock,
    rq.name as requester_name, rq.email as requester_email,
    ag.name as assignee_name
    FROM tickets t
    JOIN statuses s ON s.id = t.status_id
    JOIN users rq ON rq.id = t.requester_id
    LEFT JOIN users ag ON ag.id = t.assignee_id
    WHERE t.deleted = 0`;
  const params: SqlParam[] = [];

  if (filters.groupName) {
    sql += ' AND t.group_name = ?';
    params.push(filters.groupName);
  }
  if (filters.requesterId) {
    sql += ' AND t.requester_id = ?';
    params.push(filters.requesterId);
  }
  if (filters.assigneeId) {
    sql += ' AND t.assignee_id = ?';
    params.push(filters.assigneeId);
  }
  if (filters.statusCategory) {
    sql += ' AND s.category = ?';
    params.push(filters.statusCategory);
  }
  if (filters.statusName) {
    sql += ' AND s.name = ?';
    params.push(filters.statusName);
  }
  if (filters.search) {
    sql += ' AND (t.subject LIKE ? OR t.display_number LIKE ? OR rq.name LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.overdueOnly) {
    sql += ` AND s.sla_clock = 'run' AND (
      (t.first_response_at IS NULL AND t.respond_by < datetime('now'))
      OR (t.resolved_at IS NULL AND t.resolve_by < datetime('now'))
    )`;
  }

  const sortCol = filters.sortBy ?? 'created_at';
  const sortDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY t.${sortCol} ${sortDir}`;
  const rows = getDb().prepare(sql).all(...params) as Record<string, unknown>[];
  return rows.map((row) => {
    const breached =
      !!row.sla_breached ||
      evaluateSlaBreach(
        row.sla_clock as string,
        row.respond_by as string | null,
        row.resolve_by as string | null,
        row.first_response_at as string | null,
        row.resolved_at as string | null,
      );
    if (breached && !row.sla_breached) {
      getDb().prepare('UPDATE tickets SET sla_breached = 1 WHERE id = ?').run(row.id as number);
    }
    return { ...row, sla_breached: breached ? 1 : 0 };
  }) as Record<string, unknown>[];
}

export function exportTicketsCsv(tickets: Record<string, unknown>[]) {
  const headers = ['display_number', 'subject', 'status_name', 'requester_name', 'assignee_name', 'created_at'];
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const row of tickets) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

export function addMessage(input: {
  ticketId: number;
  authorId: number | null;
  body: string;
  type: 'public' | 'note';
  actorId: number;
}) {
  const db = getDb();
  const ticket = getTicketById(input.ticketId);
  if (!ticket) throw new Error('NOT_FOUND');

  const ts = nowIso();
  db.prepare(
    'INSERT INTO messages (ticket_id, author_id, body, type, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(input.ticketId, input.authorId, input.body, input.type, ts);

  if (input.type === 'public' && !ticket.first_response_at && input.authorId !== ticket.requester_id) {
    db.prepare('UPDATE tickets SET first_response_at = ?, updated_at = ? WHERE id = ?').run(ts, ts, input.ticketId);
  }

  if (input.type === 'public') {
    const requester = ticket.requester as { email: string };
    const author = input.authorId
      ? (db.prepare('SELECT name FROM users WHERE id = ?').get(input.authorId) as { name: string })
      : null;
    const isRequesterReply = input.authorId === ticket.requester_id;
    const assignee = ticket.assignee as { email: string } | null;
    const to = isRequesterReply
      ? (assignee?.email ?? (ticket.mailbox as string) ?? PILOT_MAILBOX)
      : requester.email;
    queueMail(
      input.ticketId,
      to,
      `Re: [${ticket.display_number}] ${ticket.subject}`,
      `${author?.name ?? 'Agent'} wrote:\n\n${input.body}`,
      isRequesterReply ? 'requester_reply' : 'agent_reply',
      isRequesterReply ? undefined : ((ticket.cc as string) || undefined),
    );
  }

  if (input.type === 'public' && REOPEN_STATUSES.includes(ticket.status.name)) {
    reopenTicket(
      input.ticketId,
      ticket.support_team as string,
      input.actorId,
      ts,
    );
  } else {
    db.prepare('UPDATE tickets SET updated_at = ? WHERE id = ?').run(ts, input.ticketId);
  }

  writeAudit('ticket', input.ticketId, input.actorId, input.type === 'note' ? 'note_added' : 'reply_added');
  return getTicketById(input.ticketId);
}

export function updateTicket(input: {
  ticketId: number;
  actorId: number;
  statusName?: string;
  assigneeId?: number | null;
  resolutionNote?: string;
  breachReason?: string;
  otherRemarks?: string;
  supportTeam?: string;
  customFields?: Record<string, string>;
}) {
  const db = getDb();
  const ticket = getTicketById(input.ticketId);
  if (!ticket) throw new Error('NOT_FOUND');
  const ts = nowIso();
  const currentStatus = ticket.status.name;

  if (input.statusName && input.statusName !== currentStatus) {
    const statusId = getStatusId(input.statusName);
    const updates: string[] = ['status_id = ?', 'updated_at = ?'];
    const values: SqlParam[] = [statusId, ts];
    if (input.statusName === 'Resolved' || input.statusName === 'Interim Resolve') {
      if (!input.resolutionNote && !ticket.resolution_note) {
        throw new Error('RESOLUTION_NOTE_REQUIRED');
      }
      updates.push('resolved_at = ?');
      values.push(ts);
      if (input.resolutionNote) {
        updates.push('resolution_note = ?');
        values.push(input.resolutionNote);
      }
      const requester = ticket.requester as { email: string };
      queueMail(
        input.ticketId,
        requester.email,
        `Re: [${ticket.display_number}] Resolved`,
        `Your ticket ${ticket.display_number} was resolved.\n\n${input.resolutionNote ?? ticket.resolution_note ?? ''}`,
        'resolved',
      );
    }
    if (input.statusName === 'Closed') {
      updates.push('closed_at = ?');
      values.push(ts);
      const requester = ticket.requester as { email: string };
      queueMail(
        input.ticketId,
        requester.email,
        `Re: [${ticket.display_number}] Closed`,
        `Your ticket ${ticket.display_number} is now closed.`,
        'closed',
      );
    }
    values.push(input.ticketId);
    db.prepare(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    writeAudit('ticket', input.ticketId, input.actorId, 'status_changed', input.statusName);
  } else if (
    input.resolutionNote &&
    (currentStatus === 'Resolved' || currentStatus === 'Interim Resolve') &&
    input.resolutionNote !== ticket.resolution_note
  ) {
    db.prepare('UPDATE tickets SET resolution_note = ?, updated_at = ? WHERE id = ?').run(
      input.resolutionNote,
      ts,
      input.ticketId,
    );
    writeAudit('ticket', input.ticketId, input.actorId, 'resolution_updated');
  }

  if (input.assigneeId !== undefined) {
    const currentAssignee = (ticket.assignee_id as number | null) ?? null;
    if (input.assigneeId !== currentAssignee) {
      db.prepare('UPDATE tickets SET assignee_id = ?, updated_at = ? WHERE id = ?').run(
        input.assigneeId,
        ts,
        input.ticketId,
      );
      writeAudit('ticket', input.ticketId, input.actorId, 'assigned', String(input.assigneeId));
    }
  }

  if (input.breachReason !== undefined) {
    db.prepare('UPDATE tickets SET breach_reason = ?, updated_at = ? WHERE id = ?').run(
      input.breachReason,
      ts,
      input.ticketId,
    );
  }

  if (input.otherRemarks !== undefined) {
    db.prepare('UPDATE tickets SET other_remarks = ?, updated_at = ? WHERE id = ?').run(
      input.otherRemarks,
      ts,
      input.ticketId,
    );
  }

  if (input.supportTeam) {
    db.prepare('UPDATE tickets SET support_team = ?, updated_at = ? WHERE id = ?').run(
      input.supportTeam,
      ts,
      input.ticketId,
    );
  }

  if (input.customFields) {
    const merged = { ...ticket.custom_fields, ...input.customFields };
    db.prepare('UPDATE tickets SET custom_fields = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(merged),
      ts,
      input.ticketId,
    );
  }

  return getTicketById(input.ticketId);
}

export function processInboundEmail(input: {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
}) {
  const match = input.subject.match(/INC-\d+/i);
  if (match) {
    const existing = getTicketByNumber(match[0]);
    if (existing) {
      const requesterId = findOrCreateRequester(input.from, input.fromName);
      return addMessage({
        ticketId: existing.id as number,
        authorId: requesterId,
        body: input.body,
        type: 'public',
        actorId: requesterId,
      });
    }
  }

  const requesterId = findOrCreateRequester(input.from, input.fromName);
  const supportTeam = input.to.includes('tech') ? 'Tech Support Team' : 'Customer Care';
  return createTicket({
    subject: input.subject,
    description: input.body,
    supportTeam,
    requesterId,
    source: 'email',
    mailbox: input.to,
    groupName: supportTeam === 'Tech Support Team' ? PILOT_GROUP : supportTeam,
  });
}

export function runAutoCloseJob(actorId: number | null = null) {
  const db = getDb();
  const resolved = db
    .prepare(
      `SELECT t.id, t.resolved_at FROM tickets t
       JOIN statuses s ON s.id = t.status_id
       WHERE s.name = 'Resolved' AND t.resolved_at IS NOT NULL AND t.closed_at IS NULL`,
    )
    .all() as { id: number; resolved_at: string }[];

  let closed = 0;
  for (const row of resolved) {
    if (shouldAutoClose(row.resolved_at)) {
      updateTicket({ ticketId: row.id, actorId: actorId ?? 1, statusName: 'Closed' });
      closed += 1;
    }
  }
  return closed;
}

export function getSupervisorReport(scope?: { groupName?: string | null }) {
  const db = getDb();
  const groupClause = scope?.groupName ? ' AND t.group_name = ?' : '';
  const groupParam = scope?.groupName ? [scope.groupName] : [];
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const createdToday = (
    db
      .prepare(`SELECT COUNT(*) as c FROM tickets t WHERE t.created_at >= ? AND t.deleted = 0${groupClause}`)
      .get(startOfDay.toISOString(), ...groupParam) as { c: number }
  ).c;
  const createdWeek = (
    db
      .prepare(`SELECT COUNT(*) as c FROM tickets t WHERE t.created_at >= ? AND t.deleted = 0${groupClause}`)
      .get(startOfWeek.toISOString(), ...groupParam) as { c: number }
  ).c;
  const createdMonth = (
    db
      .prepare(`SELECT COUNT(*) as c FROM tickets t WHERE t.created_at >= ? AND t.deleted = 0${groupClause}`)
      .get(startOfMonth.toISOString(), ...groupParam) as { c: number }
  ).c;
  const open = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM tickets t JOIN statuses s ON s.id = t.status_id
         WHERE s.category != 'done' AND t.deleted = 0${groupClause}`,
      )
      .get(...groupParam) as { c: number }
  ).c;
  const breached = (
    db
      .prepare(`SELECT COUNT(*) as c FROM tickets t WHERE t.sla_breached = 1 AND t.deleted = 0${groupClause}`)
      .get(...groupParam) as { c: number }
  ).c;
  const slaMet = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM tickets t
       JOIN statuses s ON s.id = t.status_id
       WHERE t.deleted = 0 AND t.sla_breached = 0 AND s.category = 'done'${groupClause}`,
      )
      .get(...groupParam) as { c: number }
  ).c;
  const overdue = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM tickets t
       JOIN statuses s ON s.id = t.status_id
       WHERE t.deleted = 0 AND s.category != 'done' AND s.sla_clock = 'run'
       AND ((t.first_response_at IS NULL AND t.respond_by < datetime('now'))
         OR (t.resolved_at IS NULL AND t.resolve_by < datetime('now')))${groupClause}`,
      )
      .get(...groupParam) as { c: number }
  ).c;
  const byTeam = db
    .prepare(
      `SELECT group_name, COUNT(*) as count FROM tickets t WHERE t.deleted = 0${groupClause} GROUP BY group_name ORDER BY count DESC`,
    )
    .all(...groupParam);
  const byStatus = db
    .prepare(
      `SELECT s.name as status, COUNT(*) as count FROM tickets t
       JOIN statuses s ON s.id = t.status_id WHERE t.deleted = 0${groupClause} GROUP BY s.name`,
    )
    .all(...groupParam);
  const byAgent = db
    .prepare(
      `SELECT COALESCE(ag.name, 'Unassigned') as agent, COUNT(*) as count
       FROM tickets t
       LEFT JOIN users ag ON ag.id = t.assignee_id
       WHERE t.deleted = 0${groupClause}
       GROUP BY t.assignee_id ORDER BY count DESC`,
    )
    .all(...groupParam);

  return { createdToday, createdWeek, createdMonth, open, overdue, breached, slaMet, byTeam, byStatus, byAgent };
}

export function getOutbox() {
  return getDb()
    .prepare('SELECT * FROM mail_outbox ORDER BY sent_at DESC LIMIT 100')
    .all() as Record<string, unknown>[];
}
