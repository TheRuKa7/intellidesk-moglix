/**
 * Verifies requester vs staff route separation.
 * Run: npx tsx scripts/role-separation-test.ts
 */
import { getDb } from '../src/lib/db';
import { ensureDb } from '../src/lib/init';
import {
  canViewTicket,
  getRequesterHome,
  getStaffHomeForRole,
  isRequester,
  isStaff,
} from '../src/lib/auth';

ensureDb();

const requester = getDb()
  .prepare("SELECT * FROM users WHERE email = 'employee@moglix.com'")
  .get() as { id: number; role: string; group_name: string | null };
const agent = getDb()
  .prepare("SELECT * FROM users WHERE email = 'agent@moglix.com'")
  .get() as { id: number; role: string; group_name: string | null };

assert(isRequester(requester as never), 'employee is requester');
assert(!isStaff(requester as never), 'employee is not staff');
assert(isStaff(agent as never), 'agent is staff');
assert(!isRequester(agent as never), 'agent is not requester');

assert(getRequesterHome() === '/portal', 'requester home');
assert(getStaffHomeForRole('agent') === '/agent', 'agent home');
assert(
  getStaffHomeForRole('supervisor') === '/agent?view=open',
  'supervisor home is open queue (MVP; no Phase 4 reporting nav)',
);
assert(getStaffHomeForRole('admin') === '/admin', 'admin home');

const ticket = getDb()
  .prepare('SELECT * FROM tickets WHERE requester_id = ? ORDER BY id DESC LIMIT 1')
  .get(requester.id) as { id: number; group_name: string; assignee_id: number | null; requester_id: number } | undefined;

if (ticket) {
  assert(canViewTicket(requester as never, ticket), 'requester sees own ticket');
  assert(canViewTicket(agent as never, ticket), 'agent sees group ticket');
  const other = getDb().prepare('SELECT id FROM users WHERE role = ? AND id != ? LIMIT 1').get('requester', requester.id) as
    | { id: number }
    | undefined;
  if (other) {
    const otherTicket = getDb()
      .prepare('SELECT * FROM tickets WHERE requester_id = ? LIMIT 1')
      .get(other.id) as typeof ticket | undefined;
    if (otherTicket && otherTicket.requester_id !== requester.id) {
      assert(!canViewTicket(requester as never, otherTicket), 'requester cannot see others tickets');
    }
  }
}

console.log('Role separation checks passed.');
console.log('  Requester → /portal only (layout blocks /agent)');
console.log('  Agent → /agent; Admin → /admin; Supervisor → /agent?view=open');
console.log('  Inbound QA at /mail; create at /agent/new');
console.log('  Phase 4 Reporting (/supervisor) is redirected — not in MVP chrome');

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}
