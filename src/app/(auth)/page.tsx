import Link from 'next/link';
import { DEMO_USERS } from '@/lib/constants';
import { getDb } from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { getStaffHome, getStaffHomeForRole, setSessionUser, getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

async function login(formData: FormData) {
  'use server';
  ensureDb();
  const email = String(formData.get('email') ?? '');
  const user = getDb()
    .prepare('SELECT id, role FROM users WHERE email = ?')
    .get(email) as { id: number; role: string } | undefined;
  if (!user) redirect('/?error=invalid');
  await setSessionUser(user.id);
  if (user.role === 'requester') redirect('/portal');
  redirect(getStaffHomeForRole(user.role));
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  const sp = await searchParams;
  if (user) {
    if (user.role === 'requester') redirect('/portal');
    redirect(getStaffHome(user));
  }

  return (
    <div className="hero">
      <div>
        <h1 className="hero-title">Moglix IntelliDesk</h1>
        <p className="hero-lead">
          Two separate experiences: employees report and track issues in the Help Portal; agents and
          supervisors work tickets in the Agent Desk.
        </p>
        <div className="grid grid-2" style={{ gap: 16, marginTop: 24 }}>
          <div className="card card-accent-customer">
            <h3 className="card-title">Employee portal</h3>
            <p className="field-hint" style={{ marginTop: 0 }}>
              Report incidents, track requests, reply to agents.
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Demo: employee@moglix.com</p>
          </div>
          <div className="card card-accent-desk">
            <h3 className="card-title">Agent desk</h3>
            <p className="field-hint" style={{ marginTop: 0 }}>
              Queue, workbench, internal notes, mail &amp; reports.
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
              Demo: agent@moglix.com · supervisor@moglix.com
            </p>
          </div>
        </div>
      </div>
      <div className="card login-card">
        <h2 className="card-title">Sign in</h2>
        {sp.error === 'invalid' ? (
          <div className="banner banner-warn" style={{ marginBottom: 12 }}>
            Could not sign in with that account. Choose a demo account below.
          </div>
        ) : null}
        <p className="field-hint" style={{ marginTop: 0 }}>
          Production uses Microsoft SSO. You will be routed to the correct experience for your role.
        </p>
        <form action={login}>
          <label htmlFor="email">Account</label>
          <select id="email" name="email" defaultValue="employee@moglix.com">
            {DEMO_USERS.map((u) => (
              <option key={u.email} value={u.email}>
                {u.name} — {u.role}
              </option>
            ))}
          </select>
          <button className="btn" type="submit" style={{ width: '100%' }}>
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
