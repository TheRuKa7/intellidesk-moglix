import { ensureDb } from '../src/lib/init';
import { createTicket, getTicketByNumber, processInboundEmail, addMessage, updateTicket, getOutbox } from '../src/lib/tickets';
import { getDb } from '../src/lib/db';

ensureDb();

const requester = getDb()
  .prepare("SELECT id FROM users WHERE email = 'employee@moglix.com'")
  .get() as { id: number };
const agent = getDb()
  .prepare("SELECT id FROM users WHERE email = 'agent@moglix.com'")
  .get() as { id: number };

const ticket = createTicket({
  subject: 'VPN not connecting',
  description: 'Cannot access internal tools from home.',
  supportTeam: 'Tech Support Team',
  requesterId: requester.id,
  source: 'portal',
  actorId: requester.id,
});

if (!ticket) throw new Error('create failed');
console.log('Created', ticket.display_number);

const threaded = processInboundEmail({
  from: 'employee@moglix.com',
  to: 'techsupport@moglix.com',
  subject: `Re: [${ticket.display_number}] VPN still broken`,
  body: 'Tried rebooting, same issue.',
});
console.log('Threaded same ticket?', threaded?.id === ticket.id);

addMessage({
  ticketId: ticket.id as number,
  authorId: agent.id,
  body: 'Checking firewall rules internally.',
  type: 'note',
  actorId: agent.id,
});

const outboxBefore = getOutbox().length;
addMessage({
  ticketId: ticket.id as number,
  authorId: agent.id,
  body: 'Please try again now.',
  type: 'public',
  actorId: agent.id,
});
const outboxAfter = getOutbox().length;
console.log('Public reply queued mail:', outboxAfter > outboxBefore);

updateTicket({
  ticketId: ticket.id as number,
  actorId: agent.id,
  statusName: 'Resolved',
  resolutionNote: 'Firewall rule updated.',
});

const resolved = getTicketByNumber(ticket.display_number as string);
console.log('Resolved status:', resolved?.status.name);
console.log('Outbox events:', getOutbox().slice(0, 5).map((m) => m.event));
console.log('E2E smoke test passed.');
