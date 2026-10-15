/**
 * Full E2E domain test — cross-checked against workbook MVP (In MVP = YES).
 * Run: npm run test:e2e
 */
import { ensureDb } from '../src/lib/init';
import { getDb } from '../src/lib/db';
import {
  PORTAL_SUPPORT_TEAMS,
  REQUESTER_STATUS_LABELS,
  STATUSES,
  TICKET_COUNTER_START,
} from '../src/lib/constants';
import { formatStatusLabel } from '../src/lib/format';
import {
  addMessage,
  createTicket,
  getOutboxForTicket,
  getSupervisorReport,
  getTicketById,
  getTicketByNumber,
  listTickets,
  processInboundEmail,
  runAutoCloseJob,
  updateTicket,
} from '../src/lib/tickets';
import { evaluateSlaBreach } from '../src/lib/sla';
import { canViewTicket, isRequester, isStaff } from '../src/lib/auth';

ensureDb();

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${msg}`);
  }
}

const requester = getDb()
  .prepare("SELECT * FROM users WHERE email = 'employee@moglix.com'")
  .get() as { id: number; role: string; group_name: string | null };
const agent = getDb()
  .prepare("SELECT * FROM users WHERE email = 'agent@moglix.com'")
  .get() as { id: number; role: string; group_name: string | null };
const supervisor = getDb()
  .prepare("SELECT * FROM users WHERE email = 'supervisor@moglix.com'")
  .get() as { id: number; role: string; group_name: string | null };

console.log('\n=== MFI-034 / seed: 25 statuses (workbook R2) ===');
const statusCount = (getDb().prepare('SELECT COUNT(*) as c FROM statuses').get() as { c: number }).c;
assert(statusCount >= STATUSES.length, `at least ${STATUSES.length} statuses seeded (got ${statusCount})`);
assert(
  formatStatusLabel('Pending', true) === 'Awaiting your Reply',
  'requester label for Pending matches workbook',
);
assert(
  REQUESTER_STATUS_LABELS.Open === 'Being Processed',
  'requester label for Open matches workbook',
);

console.log('\n=== Portal: 12 visible support teams (PRD 4.1) ===');
const portalTeams = getDb()
  .prepare('SELECT COUNT(*) as c FROM support_teams WHERE portal_visible = 1')
  .get() as { c: number };
assert(portalTeams.c === PORTAL_SUPPORT_TEAMS.length, `portal shows ${PORTAL_SUPPORT_TEAMS.length} teams`);
assert(PORTAL_SUPPORT_TEAMS.length === 12, 'PORTAL_SUPPORT_TEAMS constant has 12 values');

console.log('\n=== MFI-033: ticket numbering above Freshservice counter ===');
const counter = Number(
  (getDb().prepare("SELECT value FROM settings WHERE key = 'ticket_counter'").get() as { value: string }).value,
);
assert(counter > TICKET_COUNTER_START, 'ticket counter above migration floor');

console.log('\n=== Role separation (MFI-015) ===');
assert(isRequester(requester as never), 'employee is requester');
assert(isStaff(agent as never), 'agent is staff');
assert(isStaff(supervisor as never), 'supervisor is staff');

console.log('\n=== MFI-050: portal intake ===');
const ticket = createTicket({
  subject: 'E2E test — laptop issue',
  description: 'Laptop not booting after Windows update.',
  supportTeam: 'Tech Support Team',
  requesterId: requester.id,
  source: 'portal',
  cc: 'cc.colleague@moglix.com',
  otherRemarks: 'Urgent — presentation tomorrow',
  actorId: requester.id,
});
assert(!!ticket, 'ticket created');
assert(String(ticket!.display_number).startsWith('INC-'), 'ticket number assigned');
assert(Number(ticket!.number) >= TICKET_COUNTER_START, 'ticket number above Freshservice counter');

const createdMail = getOutboxForTicket(ticket!.id as number).find((m) => m.event === 'ticket_created');
assert(!!createdMail, 'confirmation email queued (MFI-028)');
assert(String(createdMail!.cc_addr).includes('cc.colleague'), 'CC included on confirmation');

const requesterTickets = listTickets({ requesterId: requester.id });
assert(requesterTickets.some((t) => t.id === ticket!.id), 'ticket visible in My requests (MFI-051)');

const agentQueue = listTickets({ groupName: agent.group_name ?? undefined });
assert(agentQueue.some((t) => t.id === ticket!.id), 'ticket in Tech Support queue');

console.log('\n=== MFI-019: auto-assign within group ===');
const assigned = getTicketById(ticket!.id as number);
assert(!!assigned?.assignee_id, 'Tech Support auto-assigns to an agent');

console.log('\n=== MFI-026: email threading ===');
const threaded = processInboundEmail({
  from: 'employee@moglix.com',
  to: 'techsupport@moglix.com',
  subject: `Re: [${ticket!.display_number}] Still broken`,
  body: 'Tried rebooting.',
});
assert(threaded?.id === ticket!.id, 'email reply threads to same ticket');

const newEmail = processInboundEmail({
  from: 'newuser@moglix.com',
  to: 'techsupport@moglix.com',
  subject: 'Brand new issue',
  body: 'Help needed',
});
assert(!!newEmail && newEmail.id !== ticket!.id, 'new email creates new ticket');

const spamBlocked = processInboundEmail({
  from: 'bot@evil-domain.example',
  to: 'techsupport@moglix.com',
  subject: 'Spam',
  body: 'Click here',
});
assert(spamBlocked === null, 'non-allowlisted sender quarantined (MFI-029)');

console.log('\n=== MFI-044: agent conversation ===');
// Ticket-scoped outbox — global getOutbox() is LIMIT 100 and flakes when prior suites fill mail_outbox.
const outboxBeforeNote = getOutboxForTicket(ticket!.id as number).length;
addMessage({
  ticketId: ticket!.id as number,
  authorId: agent.id,
  body: 'Investigating internally.',
  type: 'note',
  actorId: agent.id,
});
assert(
  getOutboxForTicket(ticket!.id as number).length === outboxBeforeNote,
  'internal note does not queue email',
);

const outboxBeforeReply = getOutboxForTicket(ticket!.id as number).filter(
  (m) => m.event === 'agent_reply',
).length;
addMessage({
  ticketId: ticket!.id as number,
  authorId: agent.id,
  body: 'Please try VPN again.',
  type: 'public',
  actorId: agent.id,
});
assert(
  getOutboxForTicket(ticket!.id as number).filter((m) => m.event === 'agent_reply').length >
    outboxBeforeReply,
  'public reply queues email to requester',
);
assert(!!getTicketById(ticket!.id as number)?.first_response_at, 'first response recorded (MFI-036)');

console.log('\n=== Internal note does not reopen ===');
updateTicket({
  ticketId: ticket!.id as number,
  actorId: agent.id,
  statusName: 'Resolved',
  resolutionNote: 'Fixed temporarily.',
});
const statusBeforeNote = getTicketById(ticket!.id as number)!.status.name;
addMessage({
  ticketId: ticket!.id as number,
  authorId: agent.id,
  body: 'Checking logs internally after resolve.',
  type: 'note',
  actorId: agent.id,
});
assert(
  getTicketById(ticket!.id as number)!.status.name === statusBeforeNote,
  'internal note does not reopen resolved ticket',
);

console.log('\n=== MFI-036: SLA pause while Pending ===');
updateTicket({ ticketId: ticket!.id as number, actorId: agent.id, statusName: 'Pending' });
const pending = getTicketById(ticket!.id as number)!;
const breachWhilePending = evaluateSlaBreach(
  pending.status.sla_clock,
  pending.respond_by as string,
  pending.resolve_by as string,
  pending.first_response_at as string,
  pending.resolved_at as string,
  new Date('2099-01-01'),
);
assert(!breachWhilePending, 'SLA does not breach while Pending');

console.log('\n=== MFI-041: resolution note required ===');
const noteTicket = createTicket({
  subject: 'Resolution note required test',
  description: 'Fresh ticket for resolve validation.',
  supportTeam: 'Tech Support Team',
  requesterId: requester.id,
  source: 'portal',
  actorId: requester.id,
});
let resolutionRequired = false;
try {
  updateTicket({
    ticketId: noteTicket!.id as number,
    actorId: agent.id,
    statusName: 'Resolved',
  });
} catch (e) {
  resolutionRequired = e instanceof Error && e.message === 'RESOLUTION_NOTE_REQUIRED';
}
assert(resolutionRequired, 'resolve without note throws RESOLUTION_NOTE_REQUIRED');

console.log('\n=== MFI-052: requester reply reopens ===');
updateTicket({
  ticketId: ticket!.id as number,
  actorId: agent.id,
  statusName: 'Resolved',
  resolutionNote: 'Reimaged laptop.',
});
addMessage({
  ticketId: ticket!.id as number,
  authorId: requester.id,
  body: 'Still having issues.',
  type: 'public',
  actorId: requester.id,
});
const reopened = getTicketById(ticket!.id as number)!;
assert(reopened.status.name === 'Re-Open', 'requester reply reopens resolved ticket');
const lastReply = getOutboxForTicket(ticket!.id as number).find((m) => m.event === 'requester_reply');
assert(
  lastReply && String(lastReply.to_addr).includes('moglix.com'),
  'requester reply emails agent or team mailbox',
);
assert(reopened.resolved_at === null, 'reopen clears resolved timestamp');
assert(!reopened.sla_breached, 'reopen resets SLA breach flag');
assert(reopened.first_response_at === null, 'reopen resets first-response SLA');

console.log('\n=== MFI-015: visibility scope ===');
assert(canViewTicket(requester as never, ticket! as never), 'requester sees own ticket');
assert(canViewTicket(agent as never, ticket! as never), 'agent sees group ticket');

const otherGroupTicket = createTicket({
  subject: 'Customer care only',
  description: 'Routed elsewhere',
  supportTeam: 'Customer Care',
  requesterId: requester.id,
  source: 'email',
  groupName: 'Customer Care',
  actorId: requester.id,
});
assert(
  !canViewTicket(agent as never, otherGroupTicket! as never),
  'agent cannot see other group ticket',
);

console.log('\n=== No duplicate resolve emails ===');
updateTicket({
  ticketId: ticket!.id as number,
  actorId: agent.id,
  statusName: 'Resolved',
  resolutionNote: 'Final fix applied.',
});
const outboxAfterResolve = getOutboxForTicket(ticket!.id as number).filter(
  (m) => m.event === 'resolved',
).length;
updateTicket({
  ticketId: ticket!.id as number,
  actorId: agent.id,
  statusName: 'Resolved',
  resolutionNote: 'Final fix applied.',
});
assert(
  getOutboxForTicket(ticket!.id as number).filter((m) => m.event === 'resolved').length ===
    outboxAfterResolve,
  're-saving resolved ticket does not send another resolved email',
);

console.log('\n=== Auto-close + close notification (PRD 3.4) ===');
getDb()
  .prepare('UPDATE tickets SET resolved_at = ? WHERE id = ?')
  .run('2020-01-01T10:00:00.000Z', ticket!.id as number);
const closedCount = runAutoCloseJob(agent.id);
assert(closedCount >= 1, 'auto-close job closes old resolved tickets');
const closedTicket = getTicketByNumber(ticket!.display_number as string)!;
assert(closedTicket.status.name === 'Closed', 'ticket auto-closed');
const closedMail = getOutboxForTicket(ticket!.id as number).find((m) => m.event === 'closed');
assert(!!closedMail, 'close notification email queued');

console.log('\n=== Queue health helper (workbook MFI-146 is Phase 4 — lib only, no UI) ===');
const report = getSupervisorReport({ groupName: agent.group_name });
assert(typeof report.createdToday === 'number', 'report has created today');
assert(typeof report.open === 'number', 'report has open count');
assert(typeof report.overdue === 'number', 'report has overdue count');
assert(Array.isArray(report.byAgent), 'report splits by agent');
assert(Array.isArray(report.byTeam), 'report splits by team');

console.log('\n=== Ticket IDs never reused ===');
const before = counter;
createTicket({
  subject: 'ID monotonicity check',
  description: 'Second ticket',
  supportTeam: 'Tech Support Team',
  requesterId: requester.id,
  source: 'portal',
  actorId: requester.id,
});
const after = Number(
  (getDb().prepare("SELECT value FROM settings WHERE key = 'ticket_counter'").get() as { value: string }).value,
);
assert(after > before, 'ticket counter increments monotonically');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
console.log('E2E test passed.\n');
