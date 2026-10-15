import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FlashBanner } from '@/components/FlashBanner';
import { SubmitButton } from '@/components/SubmitButton';
import { DEMO_USERS } from '@/lib/constants';
import { getDb } from '@/lib/db';
import { ensureDb } from '@/lib/init';
import { getStaffHome, getStaffHomeForRole, setSessionUser, getSessionUser } from '@/lib/auth';

async function login(formData: FormData) {
  'use server';
  ensureDb();
  const email = String(formData.get('email') ?? '');
  const user = getDb()
    .prepare('SELECT id, role FROM users WHERE email = ? AND active = 1')
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
    <div className="login-page">
      <section className="login-showcase" aria-hidden>
        <div className="login-showcase-inner">
          <p className="login-eyebrow">Moglix · IntelliDesk</p>
          <h1 className="login-showcase-title">
            Enterprise service desk
            <br />
            for Moglix operations.
          </h1>
          <p className="login-showcase-lead">
            Email-first ticketing with SLA clocks, role-scoped queues, and an employee portal — in one
            workspace.
          </p>
          <ul className="login-feature-list">
            <li>Agent workbench with reply, note, merge, and watch</li>
            <li>Portal intake with confirmation and reopen</li>
            <li>Pilot group: Tech Support Team</li>
          </ul>
          <div className="login-trust-row">
            <span>SSO-ready</span>
            <span>Audit trailed</span>
            <span>SLA aware</span>
          </div>
        </div>
        <div className="login-mesh" />
      </section>
      <section className="login-panel">
        <div className="login-panel-inner">
          <Link href="/" className="login-logo">
            <span className="login-logo-mark">moglix</span>
            <span className="login-logo-product">IntelliDesk</span>
          </Link>
          <h2 className="login-title">Sign in to your workspace</h2>
          <p className="login-subtitle">
            Choose a workspace role to continue. Production sign-in uses Microsoft Entra ID.
          </p>
          {sp.error === 'invalid' ? (
            <FlashBanner variant="warn">Could not sign in. Select a valid workspace account.</FlashBanner>
          ) : null}
          <form action={login} className="login-form">
            <label htmlFor="email">Workspace account</label>
            <select id="email" name="email" defaultValue="employee@moglix.com" required>
              {DEMO_USERS.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.name} — {u.role}
                </option>
              ))}
            </select>
            <SubmitButton className="btn btn-login" pendingLabel="Signing in…">
              Continue
            </SubmitButton>
          </form>
          <div className="login-divider">
            <span>or</span>
          </div>
          <button
            className="btn btn-ms"
            type="button"
            disabled
            title="Microsoft Entra ID connects in production"
          >
            <span className="ms-icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 0h7.5v7.5H0zm8.5 0H16v7.5H8.5zM0 8.5H7.5V16H0zm8.5 0H16V16H8.5z" />
              </svg>
            </span>
            Sign in with Microsoft
          </button>
          <p className="login-footnote">
            Secure workspace access for Moglix employees and support agents.
          </p>
        </div>
      </section>
    </div>
  );
}
