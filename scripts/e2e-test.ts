/**
 * Full E2E domain test — run: npx tsx scripts/e2e-test.ts
 */
import { ensureDb } from '../src/lib/init';
import { getDb } from '../src/lib/db';
import {
  addMessage,
  createTicket,
  getOutbox,
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

console.log('\n=== Role separation ===');
assert(isRequester(requester as never), 'employee is requester');
assert(isStaff(agent as never), 'agent is staff');
assert(isStaff(supervisor as never), 'supervisor is staff');

console.log('\n=== Portal intake ===');
const ticket = createTicket({
  subject: 'E2E test — laptop issue',
  description: 'Laptop not booting after Windows update.',
  supportTeam: 'Tech Support Team',
  requesterId: requester.id,
  source: 'portal',
  otherRemarks: 'Urgent — presentation tomorrow',
  actorId: requester.id,
});
assert(!!ticket, 'ticket created');
assert(String(ticket!.display_number).startsWith('INC-'), 'ticket number assigned');
assert(Number(ticket!.number) >= 2176596, 'ticket number above Freshservice counter');

const requesterTickets = listTickets({ requesterId: requester.id });
assert(requesterTickets.some((t) => t.id === ticket!.id), 'ticket visible in requester list');

console.log('\n=== Email threading ===');
const threaded = processInboundEmail({
  from: 'employee@moglix.com',
  to: 'techsupport@moglix.com',
  subject: `Re: [${ticket!.display_number}] Still broken`,
  body: 'Tried rebooting.',
});
assert(threaded?.id === ticket!.id, 'email reply threads to same ticket');

const newEmail = processInboundEmail({
  from: 'newuser@external.com',
  to: 'techsupport@moglix.com',
  subject: 'Brand new issue',
  body: 'Help needed',
});
assert(newEmail?.id !== ticket!.id, 'new email creates new ticket');

console.log('\n=== Agent workbench ===');
const outboxBeforeNote = getOutbox().length;
addMessage({
  ticketId: ticket!.id as number,
  authorId: agent.id,
  body: 'Investigating internally.',
  type: 'note',
  actorId: agent.id,
});
assert(getOutbox().length === outboxBeforeNote, 'internal note does not queue email');

const outboxBeforeReply = getOutbox().filter((m) => m.event === 'agent_reply').length;
addMessage({
  ticketId: ticket!.id as number,
  authorId: agent.id,
  body: 'Please try VPN again.',
  type: 'public',
  actorId: agent.id,
});
assert(
  getOutbox().filter((m) => m.event === 'agent_reply').length > outboxBeforeReply,
  'public reply queues email to requester',
);
assert(!!getTicketById(ticket!.id as number)?.first_response_at, 'first response recorded');

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

console.log('\n=== SLA pause (Pending) ===');
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

console.log('\n=== Resolve + reopen ===');
updateTicket({
  ticketId: ticket!.id as number,
  actorId: agent.id,
  statusName: 'Open',
});
updateTicket({
  ticketId: ticket!.id as number,
  actorId: agent.id,
  statusName: 'Resolved',
  resolutionNote: 'Reimaged laptop.',
});
let resolved = getTicketById(ticket!.id as number)!;
assert(resolved.status.name === 'Resolved', 'ticket resolved');

addMessage({
  ticketId: ticket!.id as number,
  authorId: requester.id,
  body: 'Still having issues.',
  type: 'public',
  actorId: requester.id,
});
const reopened = getTicketById(ticket!.id as number)!;
assert(reopened.status.name === 'Re-Open', 'requester reply reopens resolved ticket');
const lastReply = getOutbox().find((m) => m.event === 'requester_reply');
assert(
  lastReply && String(lastReply.to_addr).includes('moglix.com'),
  'requester reply emails agent or team mailbox',
);
assert(reopened.resolved_at === null, 'reopen clears resolved timestamp');
assert(!reopened.sla_breached, 'reopen resets SLA breach flag');
assert(reopened.first_response_at === null, 'reopen resets first-response SLA');

console.log('\n=== Visibility ===');
assert(canViewTicket(requester as never, ticket! as never), 'requester sees own ticket');
assert(canViewTicket(agent as never, ticket! as never), 'agent sees group ticket');

const agentQueue = listTickets({ groupName: agent.group_name ?? undefined });
assert(agentQueue.some((t) => t.id === ticket!.id), 'ticket in agent queue');

console.log('\n=== Re-save without duplicate emails ===');
updateTicket({
  ticketId: ticket!.id as number,
  actorId: agent.id,
  statusName: 'Resolved',
  resolutionNote: 'Final fix applied.',
});
const outboxAfterResolve = getOutbox().filter((m) => m.event === 'resolved').length;
updateTicket({
  ticketId: ticket!.id as number,
  actorId: agent.id,
  statusName: 'Resolved',
  resolutionNote: 'Final fix applied.',
});
assert(
  getOutbox().filter((m) => m.event === 'resolved').length === outboxAfterResolve,
  're-saving resolved ticket does not send another resolved email',
);

console.log('\n=== Auto-close job ===');
getDb()
  .prepare('UPDATE tickets SET resolved_at = ? WHERE id = ?')
  .run('2020-01-01T10:00:00.000Z', ticket!.id as number);
const closed = runAutoCloseJob(agent.id);
assert(closed >= 1, 'auto-close job closes old resolved tickets');
const closedTicket = getTicketByNumber(ticket!.display_number as string)!;
assert(closedTicket.status.name === 'Closed', 'ticket auto-closed');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
console.log('E2E test passed.\n');
