/**
 * Verifies OSS library integrations (mailparser, handlebars, fuse, holidays, attachments)
 * plus OSS-pattern features (canned, lock, merge — reimplemented algorithms).
 */
import { ensureDb } from '../src/lib/init';
import { detectAutoReply, detectBounce, parseMimeSource } from '../src/lib/email-parser';
import { renderNotification, listNotificationEvents } from '../src/lib/notifications';
import { searchTickets } from '../src/lib/search';
import { storeAttachmentFile, readAttachmentFile } from '../src/lib/attachments';
import { listHolidays } from '../src/lib/holidays';
import { addMessage, createTicket, getTicketById, processInboundParsed } from '../src/lib/tickets';
import { getDb } from '../src/lib/db';
import { applyCannedResponse, listCannedResponses } from '../src/lib/canned-responses';
import { acquireTicketLock, releaseTicketLock } from '../src/lib/ticket-lock';
import { addTicketTag, listTicketTags, mergeTickets } from '../src/lib/ticket-relations';

ensureDb();

async function main() {
  let failed = 0;
  function assert(cond: boolean, msg: string) {
    if (cond) console.log(`  ✓ ${msg}`);
    else {
      failed += 1;
      console.error(`  ✗ ${msg}`);
    }
  }

  console.log('\n=== mailparser (MIME) ===');
  const mime = [
    'From: Test User <employee@moglix.com>',
    'To: techsupport@moglix.com',
    'Subject: [INC-2176596] VPN issue',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'Still broken after reboot.',
  ].join('\r\n');
  const parsed = await parseMimeSource(Buffer.from(mime));
  assert(parsed.from === 'employee@moglix.com', 'parses From header');
  assert(parsed.subject.includes('INC-2176596'), 'parses Subject');

  console.log('\n=== handlebars (notifications) ===');
  assert(listNotificationEvents().length >= 7, 'notification events registered');
  const body = renderNotification('ticket_created', {
    requesterName: 'Test',
    displayNumber: 'INC-1',
    subject: 'Hi',
    description: 'Body',
  });
  assert(body.includes('INC-1'), 'handlebars renders ticket_created');

  console.log('\n=== fuse.js (search) ===');
  const results = searchTickets('VPN', { groupName: 'Tech Support Team' });
  assert(Array.isArray(results), 'search returns array');

  console.log('\n=== holidays (date-fns-tz SLA) ===');
  const holidays = listHolidays();
  assert(holidays.length >= 5, 'IST holidays seeded');

  console.log('\n=== attachment storage ===');
  const { storageKey } = storeAttachmentFile('test.txt', Buffer.from('hello'));
  const data = readAttachmentFile(storageKey);
  assert(data?.toString() === 'hello', 'round-trip attachment file');

  console.log('\n=== mailparser HTML → ticket body_html ===');
  const htmlMime = [
    'From: Test User <employee@moglix.com>',
    'To: techsupport@moglix.com',
    'Subject: HTML mail body',
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    '<p>Hello <b>IntelliDesk</b></p>',
  ].join('\r\n');
  const htmlParsed = await parseMimeSource(Buffer.from(htmlMime));
  assert(!!htmlParsed.html && htmlParsed.html.includes('IntelliDesk'), 'parses HTML part');
  const htmlIn = processInboundParsed(htmlParsed);
  assert(!!htmlIn, 'HTML mime creates ticket');
  const msgHtml = (
    getDb()
      .prepare('SELECT body_html FROM messages WHERE ticket_id = ? ORDER BY id ASC LIMIT 1')
      .get(htmlIn!.id as number) as { body_html: string | null }
  ).body_html;
  assert(!!msgHtml && msgHtml.includes('IntelliDesk'), 'body_html stored from MIME');

  console.log('\n=== auto-reply suppression ===');
  const suppressed = processInboundParsed({
    from: 'bot@external.com',
    to: 'techsupport@moglix.com',
    subject: 'Out of office',
    body: 'Away',
    attachments: [],
    isAutoReply: true,
    isBounce: false,
  });
  assert(suppressed === null, 'auto-reply does not create ticket');

  const hdr = new Map<string, unknown>([['auto-submitted', 'auto-replied']]);
  assert(detectAutoReply(hdr, 'Hello'), 'detectAutoReply reads Auto-Submitted');
  assert(
    detectBounce(new Map([['return-path', '<>']]), 'mailer-daemon@x.com', 'Undeliverable'),
    'detectBounce flags empty Return-Path',
  );

  console.log('\n=== canned · lock · merge (OSS patterns) ===');
  const canned = listCannedResponses();
  assert(canned.length >= 3, 'canned responses seeded');
  const rendered = applyCannedResponse({
    cannedId: canned[0].id,
    displayNumber: 'INC-1',
    subject: 'VPN',
    requesterName: 'Rahul',
    agentName: 'Agent',
  });
  assert(!!rendered && rendered.includes('Rahul'), 'canned Handlebars renders requester');

  const agent = getDb()
    .prepare("SELECT id FROM users WHERE email = 'agent@moglix.com'")
    .get() as { id: number };
  const requester = getDb()
    .prepare("SELECT id FROM users WHERE email = 'employee@moglix.com'")
    .get() as { id: number };
  const a = createTicket({
    subject: 'Merge source OSS',
    description: 'Source',
    supportTeam: 'Tech Support Team',
    requesterId: requester.id,
    source: 'portal',
    actorId: requester.id,
  })!;
  const b = createTicket({
    subject: 'Merge target OSS',
    description: 'Target',
    supportTeam: 'Tech Support Team',
    requesterId: requester.id,
    source: 'portal',
    actorId: requester.id,
  })!;
  addMessage({
    ticketId: a.id as number,
    authorId: requester.id,
    body: 'Please merge me',
    type: 'public',
    actorId: requester.id,
  });
  const lock = acquireTicketLock(b.id as number, agent.id);
  assert(lock.acquired, 'lock acquired by agent');
  const other = getDb()
    .prepare("SELECT id FROM users WHERE role = 'supervisor' LIMIT 1")
    .get() as { id: number };
  const blocked = acquireTicketLock(b.id as number, other.id);
  assert('blocked' in blocked && blocked.blocked, 'second agent blocked by lock');
  releaseTicketLock(b.id as number, agent.id);

  addTicketTag(b.id as number, 'vpn-oss', agent.id);
  assert(listTicketTags(b.id as number).some((t) => t.name === 'vpn-oss'), 'tag added');

  const targetId = mergeTickets({
    sourceId: a.id as number,
    targetId: b.id as number,
    actorId: agent.id,
  });
  assert(targetId === (b.id as number), 'merge returns target id');
  const sourceAfter = getTicketById(a.id as number)!;
  assert(sourceAfter.status.name === 'Merged', 'source status Merged');
  assert(
    (sourceAfter as { merged_into_id?: number }).merged_into_id === b.id,
    'source points at target',
  );

  console.log(`\n=== OSS module tests: ${failed === 0 ? 'passed' : failed + ' failed'} ===`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
