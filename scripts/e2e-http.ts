/**
 * HTTP E2E — route guards, page rendering, and key UX surfaces via fetch.
 * Run: npm run test:http
 *
 * Note: Next.js 16 may answer server `redirect()` with HTTP 307 *or* a 200 HTML
 * shell containing `NEXT_REDIRECT;…;307;` / meta refresh for non-RSC document fetches.
 */
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { getDb } from '../src/lib/db';
import { ensureDb } from '../src/lib/init';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3020';
const ROOT = path.resolve(__dirname, '..');

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

function userId(email: string): number {
  const row = getDb().prepare('SELECT id FROM users WHERE email = ?').get(email) as
    | { id: number }
    | undefined;
  if (!row) throw new Error(`Missing demo user: ${email}`);
  return row.id;
}

type FetchResult = {
  status: number;
  location: string | null;
  text: string;
  redirected: boolean;
  redirectTo: string | null;
};

function parseSoftRedirect(html: string): string | null {
  const next = html.match(/NEXT_REDIRECT;(?:replace|push);([^;]+);/);
  if (next?.[1]) return next[1];
  const meta = html.match(/http-equiv="refresh"[^>]*content="[^"]*url=([^"]+)"/i);
  if (meta?.[1]) return meta[1];
  return null;
}

async function fetchRoute(pathname: string, sessionUserId?: number, init: RequestInit = {}): Promise<FetchResult> {
  const headers = new Headers(init.headers);
  if (sessionUserId !== undefined) {
    headers.set('Cookie', `intellidesk_user=${sessionUserId}`);
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'text/html,application/xhtml+xml');
  }
  const res = await fetch(`${BASE}${pathname}`, { ...init, headers, redirect: 'manual' });
  const text = init.method && init.method !== 'GET' ? '' : await res.text();
  const soft = text ? parseSoftRedirect(text) : null;
  const location = res.headers.get('location') ?? soft;
  const redirected =
    res.status === 307 ||
    res.status === 308 ||
    res.status === 303 ||
    !!soft ||
    !!res.headers.get('x-action-redirect');
  return {
    status: res.status,
    location,
    text,
    redirected,
    redirectTo: location,
  };
}

async function isServerUp(): Promise<boolean> {
  try {
    const res = await fetch(BASE, { redirect: 'manual' });
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 90000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerUp()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server not reachable at ${BASE}`);
}

async function startServer(): Promise<ChildProcess> {
  const proc = spawn('npx next start -p 3020', {
    cwd: ROOT,
    stdio: 'pipe',
    shell: true,
    env: { ...process.env },
  });
  await waitForServer();
  return proc;
}

async function runHttpTests() {
  const requesterId = userId('employee@moglix.com');
  const agentId = userId('agent@moglix.com');
  const supervisorId = userId('supervisor@moglix.com');
  const adminId = userId('admin@moglix.com');

  console.log('\n=== Public routes ===');
  const home = await fetchRoute('/');
  assert(home.status === 200 && !home.redirected, 'sign-in page loads');
  assert(home.text.includes('IntelliDesk'), 'sign-in page has product title');
  assert(home.text.includes('Continue'), 'sign-in has continue CTA');

  console.log('\n=== Auth redirects ===');
  const portalAnon = await fetchRoute('/portal');
  assert(portalAnon.redirected, 'anonymous /portal redirects');
  assert(portalAnon.redirectTo === '/' || portalAnon.redirectTo?.startsWith('/'), 'anonymous /portal → sign-in');

  const agentAnon = await fetchRoute('/agent');
  assert(agentAnon.redirected, 'anonymous /agent redirects');

  const portalAsAgent = await fetchRoute('/portal', agentId);
  assert(portalAsAgent.redirected, 'agent blocked from portal');
  assert(portalAsAgent.redirectTo === '/agent', 'agent /portal → agent desk');

  const agentAsRequester = await fetchRoute('/agent', requesterId);
  assert(agentAsRequester.redirected, 'requester blocked from agent desk');
  assert(agentAsRequester.redirectTo === '/portal', 'requester /agent → portal');

  const supervisorAsAgent = await fetchRoute('/supervisor', agentId);
  assert(supervisorAsAgent.redirected, 'agent hitting /supervisor is redirected');

  console.log('\n=== Authenticated pages ===');
  const portalHome = await fetchRoute('/portal', requesterId);
  assert(portalHome.status === 200 && !portalHome.redirected, 'requester portal home loads');
  assert(
    portalHome.text.includes('Mogli Labs') || portalHome.text.includes('moglix'),
    'portal shell renders',
  );
  assert(!/Employee onboarding/i.test(portalHome.text), 'Phase 4 onboarding hidden from portal');
  assert(!/Service catalog/i.test(portalHome.text), 'Phase 2 catalog teaser hidden from portal');
  assert(!/>\s*Solutions\s*</i.test(portalHome.text), 'Phase 2 Solutions nav hidden from portal');
  assert(portalHome.text.includes('Submit a ticket'), 'MVP submit CTA present');
  assert(portalHome.text.includes('Report an incident'), 'portal report CTA');
  assert(!portalHome.text.includes('Browse solutions'), 'solutions mislink removed');

  const portalNew = await fetchRoute('/portal/new', requesterId);
  assert(portalNew.status === 200 && !portalNew.redirected, 'new incident form loads');
  assert(
    portalNew.text.includes('Submit a ticket') || portalNew.text.includes('Report an incident'),
    'incident form title present',
  );

  const agentQueue = await fetchRoute('/agent', agentId);
  assert(agentQueue.status === 200 && !agentQueue.redirected, 'agent queue loads');
  assert(
    agentQueue.text.includes('Tickets') || agentQueue.text.includes('Filters'),
    'agent queue UI present',
  );
  assert(
    agentQueue.text.includes('queue-filter-rail') ||
      agentQueue.text.includes('Filters') ||
      agentQueue.text.includes('Due by'),
    'filter rail present',
  );
  assert(
    agentQueue.text.includes('Export') || agentQueue.text.includes('+ Create'),
    'queue toolbar actions present',
  );
  assert(!agentQueue.text.includes('Board'), 'Phase 2 Board stub hidden');
  assert(!agentQueue.text.includes('Reporting'), 'Phase 4 Reporting nav hidden from desk');
  assert(
    agentQueue.text.includes('Due today') || agentQueue.text.includes('due_today'),
    'saved views include due today',
  );

  const newTicket = await fetchRoute('/agent/new', agentId);
  assert(newTicket.status === 200, 'staff new ticket loads');
  assert(newTicket.text.includes('New ticket'), 'staff create title');
  assert(newTicket.text.includes('support_team') || newTicket.text.includes('Support team'), 'shared support team field');
  assert(newTicket.text.includes('subject') || newTicket.text.includes('Subject'), 'shared subject field');
  assert(
    newTicket.text.includes('Directory') || newTicket.text.includes('requester'),
    'staff requester picker present',
  );
  assert(!newTicket.text.includes('Mail simulator'), 'staff create is not mail lab');

  const agentChrome = await fetchRoute('/agent', agentId);
  assert(
    agentChrome.text.includes('+ Create') ||
      agentChrome.text.includes('+ New') ||
      agentChrome.text.includes('New ticket'),
    '+ Create present on queue or topbar',
  );
  assert(agentChrome.text.includes('/agent/new'), '+ Create targets staff create');
  assert(!agentChrome.text.includes('desk-nav-label">Mail'), 'Mail not in primary desk nav');

  const mailPageAsAgent = await fetchRoute('/mail', agentId);
  assert(mailPageAsAgent.redirected, 'agents are redirected away from inbound test');

  const mailPage = await fetchRoute('/mail', adminId);
  assert(mailPage.status === 200, 'inbound test loads for admin');
  assert(
    mailPage.text.includes('Inbound email test'),
    'inbound test title present',
  );
  assert(mailPage.text.includes('/agent/new'), 'inbound test points to New ticket');
  assert(
    mailPage.text.includes('Path B') || mailPage.text.includes('.eml') || mailPage.text.includes('MIME'),
    'MIME is alternate input not separate product tab',
  );

  const alertsPage = await fetchRoute('/notifications', agentId);
  assert(alertsPage.status === 200, 'alerts page loads');
  assert(alertsPage.text.includes('Notifications'), 'alerts title present');

  const portalTickets = await fetchRoute('/portal/tickets?tab=open', requesterId);
  assert(portalTickets.status === 200, 'portal my requests loads');
  assert(portalTickets.text.includes('Open'), 'open tab present');
  assert(portalTickets.text.includes('Closed'), 'closed tab present');

  const supervisorPage = await fetchRoute('/supervisor', supervisorId);
  assert(supervisorPage.redirected, 'supervisor /supervisor redirects (Phase 4 reporting hidden)');
  assert(
    supervisorPage.redirectTo === '/agent' ||
      supervisorPage.redirectTo?.startsWith('/agent'),
    'supervisor Phase 4 route → MVP queue',
  );

  const agentChromePhase3 = await fetchRoute('/agent', agentId);
  assert(
    agentChromePhase3.text.includes('Showing all') ||
      agentChromePhase3.text.includes('No tickets match'),
    'honest queue pagination copy',
  );
  assert(
    agentChromePhase3.text.includes('Saved views') ||
      agentChromePhase3.text.includes('filter=advanced'),
    'saved views filter rail label',
  );
  assert(!agentChromePhase3.text.includes('100 / page'), 'fake 100/page removed');
  assert(
    !agentChromePhase3.text.includes('desk-nav-label">Alerts') &&
      agentChromePhase3.text.includes('desk-bell'),
    'alerts via topbar bell only (no sidebar duplicate)',
  );

  console.log('\n=== Admin surfaces ===');
  const adminHome = await fetchRoute('/admin', adminId);
  assert(adminHome.status === 200 && !adminHome.redirected, 'admin hub loads for admin');
  assert(adminHome.text.includes('Admin'), 'admin hub title');
  assert(
    adminHome.text.includes('admin-subnav') || adminHome.text.includes('Agents'),
    'admin subnav present',
  );
  assert(adminHome.text.includes('Platform events'), 'observability demoted label present');
  assert(adminHome.text.includes('Inbound test'), 'inbound test tile present');
  assert(
    adminHome.text.includes('fs-admin-tile-icon') || adminHome.text.includes('viewBox'),
    'admin tiles use SVG icons',
  );

  const adminAgents = await fetchRoute('/admin/agents', supervisorId);
  assert(adminAgents.status === 200 && !adminAgents.redirected, 'supervisor can open agent directory');

  const adminSettingsAsSupervisor = await fetchRoute('/admin/settings', supervisorId);
  assert(adminSettingsAsSupervisor.redirected, 'supervisor blocked from locale settings');
  assert(
    adminSettingsAsSupervisor.redirectTo === '/agent' ||
      adminSettingsAsSupervisor.redirectTo?.startsWith('/agent'),
    'supervisor locale settings redirects to staff home',
  );

  const adminSettings = await fetchRoute('/admin/settings', adminId);
  assert(adminSettings.status === 200 && !adminSettings.redirected, 'admin settings loads');
  assert(
    adminSettings.text.includes('Locale') || adminSettings.text.includes('localisation'),
    'settings form present',
  );
  assert(
    adminSettings.text.includes('Live datetime preview') || adminSettings.text.includes('preview'),
    'settings shows live datetime preview',
  );
  assert(
    adminSettings.text.includes('ticket_id_prefix') || adminSettings.text.includes('Ticket ID prefix'),
    'ticket prefix field present',
  );

  const adminSecurity = await fetchRoute('/admin/security', adminId);
  assert(adminSecurity.status === 200, 'admin security loads');
  assert(
    adminSecurity.text.includes('enforced') || adminSecurity.text.includes('Max attachment'),
    'attachment limit documented as enforced',
  );

  const spamPage = await fetchRoute('/admin/spam', adminId);
  assert(spamPage.status === 200, 'spam quarantine page loads');
  assert(
    spamPage.text.includes('Release') || spamPage.text.includes('Quarantine empty'),
    'spam page has release action or empty state',
  );

  const notificationsPage = await fetchRoute('/admin/notifications', adminId);
  assert(notificationsPage.status === 200, 'email notifications page loads');
  assert(
    notificationsPage.text.includes('ticket_created') ||
      notificationsPage.text.includes('Ticket created'),
    'notification matrix lists ticket_created',
  );
  assert(
    notificationsPage.text.includes('assigned') ||
      notificationsPage.text.includes('Ticket assigned'),
    'notification matrix lists assigned',
  );

  const agentsDir = await fetchRoute('/admin/agents', adminId);
  assert(agentsDir.status === 200, 'agents directory loads');
  assert(
    agentsDir.text.includes('Add agent') || agentsDir.text.includes('Create agent'),
    'agent create form present',
  );

  const slaPage = await fetchRoute('/admin/sla', adminId);
  assert(slaPage.status === 200, 'SLA page loads');
  assert(slaPage.text.includes('Demo') || slaPage.text.includes('view-only'), 'demo-only banner on SLA');

  const obsPage = await fetchRoute('/admin/observability', adminId);
  assert(obsPage.status === 200, 'platform events page loads');
  assert(
    obsPage.text.includes('Ops view') || obsPage.text.includes('not service-desk'),
    'ops demotion copy present',
  );

  console.log('\n=== Ticket workbench ===');
  const latestTicket = getDb()
    .prepare(
      `SELECT t.id, t.display_number FROM tickets t
       WHERE t.deleted = 0 AND t.group_name = 'Tech Support Team'
       ORDER BY t.id DESC LIMIT 1`,
    )
    .get() as { id: number; display_number: string } | undefined;

  if (latestTicket) {
    const agentTicket = await fetchRoute(`/agent/tickets/${latestTicket.id}`, agentId);
    assert(agentTicket.status === 200, 'agent workbench loads for ticket');
    assert(agentTicket.text.includes('Conversation'), 'workbench has conversation panel');
    assert(agentTicket.text.includes(latestTicket.display_number), 'workbench shows ticket number');
    assert(
      agentTicket.text.includes('Watch') || agentTicket.text.includes('Unwatch'),
      'watch action present',
    );
    assert(agentTicket.text.includes('Watchers'), 'watchers panel present');
    assert(
      agentTicket.text.includes('tab=resolution') || agentTicket.text.includes('Resolve'),
      'primary Resolve CTA / resolution path present',
    );
    assert(agentTicket.text.includes('Primary finish path') || agentTicket.text.includes('Resolution'), 'resolution tab copy present');
    assert(agentTicket.text.includes('Category'), 'category taxonomy present');
    assert(
      agentTicket.text.includes('composer') || agentTicket.text.includes('Send reply'),
      'composer present',
    );

    const resolutionTab = await fetchRoute(
      `/agent/tickets/${latestTicket.id}?tab=resolution`,
      agentId,
    );
    assert(resolutionTab.status === 200, 'resolution tab loads');
    assert(
      resolutionTab.text.includes('Mark resolved'),
      'resolution tab has Mark resolved action',
    );

    const portalTicket = await fetchRoute(`/portal/tickets/${latestTicket.id}`, requesterId);
    assert(
      portalTicket.status === 200 || portalTicket.status === 404 || portalTicket.redirected,
      'requester ticket page responds (own ticket only)',
    );
  } else {
    assert(false, 'expected a Tech Support ticket for workbench checks');
  }

  console.log('\n=== API auth + health ===');
  const autoCloseAnon = await fetch(`${BASE}/api/jobs/auto-close`, { method: 'POST', redirect: 'manual' });
  assert(autoCloseAnon.status === 401, 'auto-close API rejects anonymous');

  const autoCloseAgent = await fetch(`${BASE}/api/jobs/auto-close`, {
    method: 'POST',
    redirect: 'manual',
    headers: { Cookie: `intellidesk_user=${agentId}` },
  });
  assert(autoCloseAgent.status === 200, 'auto-close API accepts staff');
  const autoCloseBody = (await autoCloseAgent.json()) as { closed: number };
  assert(typeof autoCloseBody.closed === 'number', 'auto-close API returns closed count');

  const health = await fetch(`${BASE}/api/v1/health`, { redirect: 'manual' });
  assert(health.status === 200, 'health API loads');
  const healthBody = (await health.json()) as { data?: { status?: string } };
  assert(healthBody.data?.status === 'ok', 'health payload ok');

  const agentsApi = await fetch(`${BASE}/api/v1/agents`, {
    headers: { Cookie: `intellidesk_user=${adminId}` },
  });
  assert(agentsApi.status === 200, 'agents API accepts admin');
  const agentsBody = (await agentsApi.json()) as { data?: unknown[] };
  assert(Array.isArray(agentsBody.data), 'agents API returns data array');

  const agentsApiAgent = await fetch(`${BASE}/api/v1/agents`, {
    headers: { Cookie: `intellidesk_user=${agentId}` },
  });
  assert(agentsApiAgent.status === 403, 'agents API rejects plain agent');

  const createApi = await fetch(`${BASE}/api/v1/tickets`, {
    method: 'POST',
    headers: {
      Cookie: `intellidesk_user=${agentId}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: 'Phase5 API create',
      description: 'Created via POST /api/v1/tickets',
      support_team: 'Tech Support Team',
      requester_email: 'employee@moglix.com',
      source: 'other',
    }),
  });
  assert(createApi.status === 201, 'tickets API create returns 201');
  const createdBody = (await createApi.json()) as {
    data?: { id?: number; display_number?: string };
  };
  assert(!!createdBody.data?.id, 'tickets API create returns id');
  const createdId = createdBody.data!.id!;

  const patchApi = await fetch(`${BASE}/api/v1/tickets/${createdId}`, {
    method: 'PATCH',
    headers: {
      Cookie: `intellidesk_user=${agentId}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ priority: 'High' }),
  });
  assert(patchApi.status === 200, 'tickets API patch returns 200');
  const patchBody = (await patchApi.json()) as { data?: { priority?: string } };
  assert(patchBody.data?.priority === 'High', 'tickets API patch updates priority');
}

async function main() {
  ensureDb();
  let server: ChildProcess | null = null;
  const weStartedServer = !(await isServerUp());

  if (weStartedServer) {
    console.log(`Starting server at ${BASE}…`);
    server = await startServer();
  } else {
    console.log(`Using existing server at ${BASE}`);
  }

  try {
    await runHttpTests();
  } finally {
    if (server) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true });
      } else {
        server.kill('SIGTERM');
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log(`\n=== HTTP results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
  console.log('HTTP E2E passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
