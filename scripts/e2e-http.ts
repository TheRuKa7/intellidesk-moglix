/**
 * HTTP E2E — exercises route guards and page rendering via fetch.
 * Run: npm run test:http  (starts production server if port 3020 is free)
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
  const row = getDb().prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  if (!row) throw new Error(`Missing demo user: ${email}`);
  return row.id;
}

async function fetchRoute(pathname: string, sessionUserId?: number, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (sessionUserId !== undefined) {
    headers.set('Cookie', `intellidesk_user=${sessionUserId}`);
  }
  return fetch(`${BASE}${pathname}`, { ...init, headers, redirect: 'manual' });
}

async function isServerUp(): Promise<boolean> {
  try {
    const res = await fetch(BASE, { redirect: 'manual' });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 60000): Promise<void> {
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

  console.log('\n=== Public routes ===');
  const home = await fetchRoute('/');
  assert(home.status === 200, 'sign-in page loads');
  const homeHtml = await home.text();
  assert(homeHtml.includes('Moglix IntelliDesk'), 'sign-in page has product title');

  console.log('\n=== Auth redirects ===');
  const portalAnon = await fetchRoute('/portal');
  assert(portalAnon.status === 307 || portalAnon.status === 308, 'anonymous /portal redirects');
  assert(portalAnon.headers.get('location') === '/', 'anonymous /portal → sign-in');

  const agentAnon = await fetchRoute('/agent');
  assert(agentAnon.status === 307 || agentAnon.status === 308, 'anonymous /agent redirects');

  const portalAsAgent = await fetchRoute('/portal', agentId);
  assert(portalAsAgent.status === 307 || portalAsAgent.status === 308, 'agent blocked from portal');
  assert(portalAsAgent.headers.get('location') === '/agent', 'agent /portal → agent desk');

  const agentAsRequester = await fetchRoute('/agent', requesterId);
  assert(agentAsRequester.status === 307 || agentAsRequester.status === 308, 'requester blocked from agent desk');
  assert(agentAsRequester.headers.get('location') === '/portal', 'requester /agent → portal');

  const supervisorAsAgent = await fetchRoute('/supervisor', agentId);
  assert(
    supervisorAsAgent.status === 307 || supervisorAsAgent.status === 308,
    'agent blocked from supervisor reports',
  );

  console.log('\n=== Authenticated pages ===');
  const portalHome = await fetchRoute('/portal', requesterId);
  assert(portalHome.status === 200, 'requester portal home loads');
  assert((await portalHome.text()).includes('Moglix Help'), 'portal shell renders');

  const portalNew = await fetchRoute('/portal/new', requesterId);
  assert(portalNew.status === 200, 'new incident form loads');
  assert((await portalNew.text()).includes('Report an incident'), 'incident form title present');

  const agentQueue = await fetchRoute('/agent', agentId);
  assert(agentQueue.status === 200, 'agent queue loads');
  assert((await agentQueue.text()).includes('Agent queue'), 'agent queue title present');

  const mailPage = await fetchRoute('/mail', agentId);
  assert(mailPage.status === 200, 'mail simulator loads');
  assert((await mailPage.text()).includes('Mail simulator'), 'mail simulator title present');

  const supervisorPage = await fetchRoute('/supervisor', supervisorId);
  assert(supervisorPage.status === 200, 'supervisor report loads');
  assert((await supervisorPage.text()).includes('Supervisor report'), 'supervisor report title present');

  const latestTicket = getDb()
    .prepare('SELECT id, display_number FROM tickets ORDER BY id DESC LIMIT 1')
    .get() as { id: number; display_number: string } | undefined;

  if (latestTicket) {
    const agentTicket = await fetchRoute(`/agent/tickets/${latestTicket.id}`, agentId);
    assert(agentTicket.status === 200, 'agent workbench loads for ticket');
    const workbenchHtml = await agentTicket.text();
    assert(workbenchHtml.includes('Conversation'), 'workbench has conversation panel');
    assert(workbenchHtml.includes(latestTicket.display_number), 'workbench shows ticket number');

    const portalTicket = await fetchRoute(`/portal/tickets/${latestTicket.id}`, requesterId);
    assert(
      portalTicket.status === 200 || portalTicket.status === 404,
      'requester ticket page responds (own ticket only)',
    );
  }

  console.log('\n=== API auth ===');
  const autoCloseAnon = await fetchRoute('/api/jobs/auto-close', undefined, { method: 'POST' });
  assert(autoCloseAnon.status === 401, 'auto-close API rejects anonymous');

  const autoCloseAgent = await fetchRoute('/api/jobs/auto-close', agentId, { method: 'POST' });
  assert(autoCloseAgent.status === 200, 'auto-close API accepts staff');
  const autoCloseBody = (await autoCloseAgent.json()) as { closed: number };
  assert(typeof autoCloseBody.closed === 'number', 'auto-close API returns closed count');
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
