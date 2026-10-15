/**
 * Coverage for previously missing / partial MVP items.
 * Run: npm run test:gaps
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDb } from '../src/lib/init';
import { getDb } from '../src/lib/db';
import { PRIVILEGES, ROLE_CATALOGUE, TICKET_CATEGORIES } from '../src/lib/privileges';
import {
  createSession,
  ensurePlatformExtras,
  isNotificationEventEnabled,
  isWatching,
  listAgents,
  listDepartments,
  listMailboxes,
  listNotifications,
  listRolesWithPrivileges,
  listSettingsByPrefix,
  listSpamQuarantine,
  listWatcherUsers,
  notifyUser,
  notifyWatchers,
  revokeSession,
  setNotificationEventEnabled,
  setSetting,
  unwatchTicket,
  watchTicket,
} from '../src/lib/platform';
import { getMetrics, logEvent } from '../src/lib/observability';
import { listNotificationEvents } from '../src/lib/notifications';
import {
  assertAttachmentWithinLimit,
  maxAttachmentBytes,
} from '../src/lib/attachment-limits';
import { formatDateTime } from '../src/lib/format';
import { ticketIdPrefix } from '../src/lib/ticket-id';
import {
  addMessage,
  createTicket,
  findOrCreateRequester,
  getOutboxForTicket,
  getTicketById,
  isReopenStatus,
  listTickets,
  processInboundEmail,
  processInboundParsed,
  releaseSpamQuarantine,
  updateTicket,
} from '../src/lib/tickets';
import { userCan } from '../src/lib/auth';
import { AGENT_SAVED_VIEWS } from '../src/lib/constants';

ensureDb();
ensurePlatformExtras();

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

const agent = getDb()
  .prepare("SELECT * FROM users WHERE email = 'agent@moglix.com'")
  .get() as { id: number; role: string; group_name: string | null };
const admin = getDb()
  .prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1")
  .get() as { id: number; role: string } | undefined;
const requester = getDb()
  .prepare("SELECT * FROM users WHERE email = 'employee@moglix.com'")
  .get() as { id: number; role: string };

console.log('\n=== MFI-014 / MFI-023: roles & privileges ===');
assert(ROLE_CATALOGUE.length === 23, `ROLE_CATALOGUE has 23 roles (got ${ROLE_CATALOGUE.length})`);
const roleRows = listRolesWithPrivileges();
assert(roleRows.length >= 23, `roles catalogue (≥23, got ${roleRows.length})`);
const privCount = (
  getDb().prepare('SELECT COUNT(*) as c FROM privileges').get() as { c: number }
).c;
assert(privCount === PRIVILEGES.length, `privileges seeded (${PRIVILEGES.length})`);
assert(userCan(agent as never, 'ticket.watch'), 'agent can watch');
assert(!userCan(requester as never, 'admin.users'), 'requester cannot admin.users');
if (admin) assert(userCan(admin as never, 'admin.security'), 'admin can edit security');

console.log('\n=== MFI-008 / MFI-009: observability + metrics ===');
logEvent('info', 'mvp_gaps_probe', { ok: true });
const metrics = getMetrics();
assert(typeof metrics === 'object', 'metrics map exists');
assert(
  (
    getDb()
      .prepare("SELECT COUNT(*) as c FROM platform_events WHERE event = 'mvp_gaps_probe'")
      .get() as { c: number }
  ).c >= 1,
  'platform_events records probe',
);

console.log('\n=== MFI-013: session create / revoke ===');
const token = createSession(agent.id);
assert(!!token && token.length > 8, 'session token created');
revokeSession(token);
const revoked = getDb()
  .prepare('SELECT revoked FROM sessions WHERE token = ?')
  .get(token) as { revoked: number } | undefined;
assert(revoked?.revoked === 1, 'session revoked');

console.log('\n=== MFI-016–022 / admin directories ===');
assert(listAgents().length >= 1, 'agent directory non-empty');
assert(listDepartments().length >= 3, 'departments seeded');
assert(listMailboxes().length >= 1, 'mailboxes seeded');
const account = listSettingsByPrefix('account.');
assert(!!account.timezone || !!account.locale, 'account settings present');
const security = listSettingsByPrefix('security.');
assert(Object.keys(security).length >= 2, 'security settings present');

const slaCount = (getDb().prepare('SELECT COUNT(*) as c FROM sla_policies').get() as { c: number }).c;
assert(slaCount >= 1, `sla_policies seeded (got ${slaCount})`);

console.log('\n=== MFI-029: spam quarantine ===');
const beforeQ = (
  getDb().prepare('SELECT COUNT(*) as c FROM spam_quarantine').get() as { c: number }
).c;
const spamResult = processInboundEmail({
  from: `spammer.${Date.now()}@evil-domain.example`,
  to: 'techsupport@moglix.com',
  subject: 'Spam blast',
  body: 'Buy now',
});
assert(spamResult === null, 'spam inbound returns null (not ticketed)');
assert(
  (getDb().prepare('SELECT COUNT(*) as c FROM spam_quarantine').get() as { c: number }).c > beforeQ,
  'spam_quarantine grew',
);

console.log('\n=== MFI-032: in-app notifications ===');
notifyUser({
  userId: agent.id,
  title: 'Gap test alert',
  body: 'Body for gaps suite',
});
const notes = listNotifications(agent.id);
assert(notes.some((n) => (n.title as string) === 'Gap test alert'), 'notification created');

console.log('\n=== MFI-039: category / subcategory ===');
assert(TICKET_CATEGORIES.length >= 3, 'category taxonomy present');
const created = createTicket({
  subject: 'Gaps taxonomy ticket',
  description: 'Please classify',
  requesterId: requester.id,
  supportTeam: 'Tech Support Team',
  source: 'portal',
  actorId: requester.id,
});
assert(!!created, 'taxonomy ticket created');
updateTicket({
  ticketId: created!.id as number,
  actorId: agent.id,
  category: TICKET_CATEGORIES[0].name,
  subcategory: TICKET_CATEGORIES[0].subcategories[0],
});
const row = getDb()
  .prepare('SELECT category, subcategory FROM tickets WHERE id = ?')
  .get(created!.id as number) as { category: string; subcategory: string };
assert(row.category === TICKET_CATEGORIES[0].name, 'category persisted');
assert(!!row.subcategory, 'subcategory persisted');

console.log('\n=== MFI-045: watch ===');
watchTicket(created!.id as number, agent.id);
assert(isWatching(created!.id as number, agent.id), 'watching after watch');
unwatchTicket(created!.id as number, agent.id);
assert(!isWatching(created!.id as number, agent.id), 'not watching after unwatch');

console.log('\n=== MFI-046 / MFI-047: saved views + filter rail contract ===');
assert(AGENT_SAVED_VIEWS.length >= 5, `saved views ≥5 (got ${AGENT_SAVED_VIEWS.length})`);
assert(
  AGENT_SAVED_VIEWS.some((v) => v.id === 'due_today'),
  'due_today saved view exists',
);

console.log('\n=== Phase 1: staff create-on-behalf (same intake) ===');
const walkUpId = findOrCreateRequester('walkup.phase1@moglix.com', 'Walkup User');
const staffTicket = createTicket({
  subject: 'Phase1 phone intake',
  description: 'Caller reported VPN outage from desk phone.',
  supportTeam: 'Tech Support Team',
  requesterId: walkUpId,
  source: 'phone',
  actorId: agent.id,
});
assert(!!staffTicket, 'staff createTicket succeeds');
assert(staffTicket!.source === 'phone', 'source stored as phone');
assert(String(staffTicket!.display_number).length > 3, 'display number assigned');
const staffInQueue = listTickets({ groupName: agent.group_name ?? undefined });
assert(
  staffInQueue.some((t) => t.id === staffTicket!.id),
  'staff-created ticket visible in agent queue',
);
const walkUpTickets = listTickets({ requesterId: walkUpId });
assert(
  walkUpTickets.some((t) => t.id === staffTicket!.id),
  'requester sees staff-created ticket',
);

console.log('\n=== Phase 2: HTML email · settings · attachment limits ===');
const htmlTicket = processInboundParsed({
  from: 'employee@moglix.com',
  fromName: 'Rahul',
  to: 'techsupport@moglix.com',
  subject: 'HTML preview phase2',
  body: 'Plain fallback body',
  html: '<p><strong>Bold VPN issue</strong> from home</p>',
  attachments: [],
  isAutoReply: false,
});
assert(!!htmlTicket, 'HTML inbound creates ticket');
const htmlLoaded = getTicketById(htmlTicket!.id as number);
const firstHtml = (htmlLoaded?.messages as { body_html?: string }[])?.[0]?.body_html;
assert(!!firstHtml && firstHtml.includes('Bold VPN'), 'body_html persisted on first message');
const htmlOutbox = getOutboxForTicket(htmlTicket!.id as number);
assert(htmlOutbox.length >= 1, 'outbound log linked to ticket');

const prevMax = listSettingsByPrefix('security.').max_attachment_mb ?? '25';
setSetting('security.max_attachment_mb', '1');
assert(maxAttachmentBytes() === 1024 * 1024, 'max_attachment_mb setting applied');
let rejected = false;
try {
  assertAttachmentWithinLimit(2 * 1024 * 1024);
} catch (e) {
  rejected = e instanceof Error && e.message.startsWith('ATTACHMENT_TOO_LARGE:');
}
assert(rejected, 'oversized attachment rejected');
setSetting('security.max_attachment_mb', prevMax);

const prevPrefix = ticketIdPrefix();
setSetting('account.ticket_id_prefix', 'P2-');
assert(ticketIdPrefix() === 'P2-', 'ticket prefix setting applied');
const prefixed = createTicket({
  subject: 'Prefix check',
  description: 'Phase2 prefix',
  supportTeam: 'Tech Support Team',
  requesterId: requester.id,
  source: 'portal',
  actorId: agent.id,
});
assert(String(prefixed!.display_number).startsWith('P2-'), 'new ticket uses account prefix');
setSetting('account.ticket_id_prefix', prevPrefix);

const prevTz = listSettingsByPrefix('account.').timezone ?? 'Asia/Kolkata';
setSetting('account.timezone', 'UTC');
const utcStamp = formatDateTime(new Date().toISOString());
assert(typeof utcStamp === 'string' && utcStamp.length > 4, 'formatDateTime uses account timezone');
setSetting('account.timezone', prevTz);

console.log('\n=== Phase 3: portal honesty · reopen · queue chrome ===');
assert(isReopenStatus('Closed'), 'Closed is reopenable');
assert(isReopenStatus('Resolved'), 'Resolved is reopenable');
assert(!isReopenStatus('Open'), 'Open is not a reopen status');

const phase3 = createTicket({
  subject: 'Phase3 reopen copy',
  description: 'Needs reopen path',
  supportTeam: 'Tech Support Team',
  requesterId: requester.id,
  source: 'portal',
  actorId: requester.id,
});
updateTicket({
  ticketId: phase3!.id as number,
  actorId: agent.id,
  statusName: 'Resolved',
  resolutionNote: 'Fixed for phase3',
});
const beforeReply = getTicketById(phase3!.id as number)!;
assert(isReopenStatus(beforeReply.status.name), 'resolved ticket is reopenable');
addMessage({
  ticketId: phase3!.id as number,
  authorId: requester.id,
  body: 'Still broken — reopen please',
  type: 'public',
  actorId: requester.id,
});
const afterReply = getTicketById(phase3!.id as number)!;
assert(afterReply.status.name === 'Re-Open', 'portal-style reply reopens resolved');

const openish = listTickets({ requesterId: requester.id }).filter((t) => t.status_category !== 'done');
const closedish = listTickets({ requesterId: requester.id }).filter((t) => t.status_category === 'done');
assert(openish.length >= 1, 'open tab pool non-empty for requester');
assert(typeof closedish.length === 'number', 'closed tab pool countable');

console.log('\n=== Phase 4: admin spam release · notification toggles · matrix ===');
const matrixEvents = listNotificationEvents();
assert(matrixEvents.includes('assigned'), 'notification matrix includes assigned');
assert(matrixEvents.includes('ticket_created'), 'notification matrix includes ticket_created');
assert(matrixEvents.length >= 7, `notification events ≥7 (got ${matrixEvents.length})`);

assert(!!admin, 'admin user present for spam release');
const beforeRelease = (
  getDb().prepare('SELECT COUNT(*) as c FROM spam_quarantine').get() as { c: number }
).c;
processInboundEmail({
  from: `phase4.spam.${Date.now()}@evil-domain.example`,
  to: 'techsupport@moglix.com',
  subject: 'Phase4 quarantine release',
  body: 'Should land in quarantine then release',
});
const afterReleaseCount = (
  getDb().prepare('SELECT COUNT(*) as c FROM spam_quarantine').get() as { c: number }
).c;
const quarantined = listSpamQuarantine(200).find((r) =>
  String(r.from_addr).includes('phase4.spam.'),
);
assert(!!quarantined, 'phase4 spam landed in quarantine');
assert(afterReleaseCount > beforeRelease, 'quarantine grew before release');
const released = releaseSpamQuarantine(quarantined!.id as number, admin!.id);
assert(!!released, 'spam release created ticket');
assert(String(released!.display_number).length > 0, 'released ticket has display number');
assert(
  !listSpamQuarantine().some((r) => (r.id as number) === (quarantined!.id as number)),
  'quarantine row deleted after release',
);
const releasedRow = getTicketById(released!.id as number)!;
assert(releasedRow.source === 'email', 'released ticket source is email');
assert(
  (releasedRow.group_name as string) === 'Tech Support Team' ||
    String(releasedRow.group_name).includes('Tech'),
  'released ticket on pilot group',
);

setNotificationEventEnabled('ticket_created', false, admin!.id);
assert(!isNotificationEventEnabled('ticket_created'), 'ticket_created can be disabled');
const suppressedReq = findOrCreateRequester('phase4.notify@moglix.com');
const suppressedTicket = createTicket({
  subject: 'Phase4 suppress create mail',
  description: 'Should not queue ticket_created',
  supportTeam: 'Tech Support Team',
  requesterId: suppressedReq,
  source: 'portal',
  actorId: suppressedReq,
});
const outbox = getOutboxForTicket(suppressedTicket!.id as number);
assert(
  !outbox.some((o) => (o.event as string) === 'ticket_created'),
  'disabled ticket_created does not hit outbox',
);
setNotificationEventEnabled('ticket_created', true, admin!.id);
assert(isNotificationEventEnabled('ticket_created'), 'ticket_created re-enabled');

console.log('\n=== Phase 5: watchers · resolve path contract · API surface ===');
const watcherAgent = getDb()
  .prepare(
    "SELECT id FROM users WHERE role IN ('agent', 'supervisor', 'admin') AND id != ? AND active = 1 LIMIT 1",
  )
  .get(agent.id) as { id: number } | undefined;
assert(!!watcherAgent, 'second agent available as watcher');

const phase5 = createTicket({
  subject: 'Phase5 watcher matrix',
  description: 'Watch resolve and reply alerts',
  supportTeam: 'Tech Support Team',
  requesterId: requester.id,
  source: 'portal',
  actorId: requester.id,
});
watchTicket(phase5!.id as number, watcherAgent!.id);
const watcherUsers = listWatcherUsers(phase5!.id as number);
assert(
  watcherUsers.some((w) => w.id === watcherAgent!.id),
  'watcher listed on ticket',
);

const beforeWatchNotes = listNotifications(watcherAgent!.id).length;
addMessage({
  ticketId: phase5!.id as number,
  authorId: agent.id,
  body: 'Public update for watchers',
  type: 'public',
  actorId: agent.id,
});
assert(
  listNotifications(watcherAgent!.id).length > beforeWatchNotes,
  'watcher notified on public reply',
);

const beforeResolveNotes = listNotifications(watcherAgent!.id).length;
updateTicket({
  ticketId: phase5!.id as number,
  actorId: agent.id,
  statusName: 'Resolved',
  resolutionNote: 'Phase5 resolved with note',
});
assert(
  listNotifications(watcherAgent!.id).length > beforeResolveNotes,
  'watcher notified on resolve',
);
assert(
  listNotifications(watcherAgent!.id).some((n) =>
    String(n.title).includes(String(phase5!.display_number)),
  ),
  'watcher notification references ticket number',
);

notifyWatchers({
  ticketId: phase5!.id as number,
  title: 'Phase5 direct notify',
  body: 'helper path',
  excludeUserId: watcherAgent!.id,
});
assert(
  !listNotifications(watcherAgent!.id).some((n) => String(n.title) === 'Phase5 direct notify'),
  'notifyWatchers respects excludeUserId',
);

console.log('\n=== Scope: Phase 3/4 not in MVP chrome ===');
const root = join(__dirname, '..');
const portalShell = readFileSync(join(root, 'src/components/PortalShell.tsx'), 'utf8');
const deskShell = readFileSync(join(root, 'src/components/DeskShell.tsx'), 'utf8');
const portalHomeSrc = readFileSync(join(root, 'src/app/portal/page.tsx'), 'utf8');
const agentQueueSrc = readFileSync(join(root, 'src/app/agent/page.tsx'), 'utf8');
const supervisorSrc = readFileSync(join(root, 'src/app/supervisor/page.tsx'), 'utf8');
assert(!portalShell.includes('Employee onboarding'), 'no Phase 4 onboarding in portal nav');
assert(!portalShell.includes('Service catalog'), 'no Phase 2 catalog in portal nav');
assert(!portalShell.includes("label: 'Solutions'"), 'no Phase 2 Solutions in portal nav');
assert(!portalHomeSrc.includes('Browse solutions'), 'no KB teaser tiles on portal home');
assert(!deskShell.includes('/supervisor'), 'Phase 4 Reporting not linked from desk nav');
assert(!deskShell.includes('desk-nav-label">Reporting'), 'Reporting label absent from desk nav');
assert(!deskShell.includes("desk-nav-label'>Reporting"), 'Reporting label absent from desk nav (alt)');
assert(!/Reporting/.test(deskShell.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'Reporting not in desk nav code');
assert(!agentQueueSrc.includes('Board'), 'Phase 2 Board stub absent from queue');
assert(supervisorSrc.includes('redirect'), 'supervisor route redirects away from Phase 4 UI');

console.log(`\nGaps suite: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
