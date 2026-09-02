import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { logout } from '@/lib/actions';

export async function PortalShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  const NAV = [
    { href: '/portal', label: 'Home' },
    { href: '/portal/tickets', label: 'My requests' },
    { href: '/portal/new', label: 'Report incident' },
  ];

  return (
    <div className="app app-customer">
      <header className="topbar topbar-customer">
        <div className="topbar-left">
          <Link href="/portal" className="brand">
            <span className="brand-mark customer">?</span>
            <span>
              <span className="brand-text">Moglix Help</span>
              <span className="brand-sub">Employee support portal</span>
            </span>
          </Link>
          <nav className="nav" aria-label="Portal">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="nav-link">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="topbar-right">
          {user ? (
            <>
              <div className="user-chip">
                <span className="user-name">{user.name}</span>
                <span className="user-role">Employee</span>
              </div>
              <form action={logout}>
                <button type="submit" className="btn btn-ghost btn-sm">
                  Sign out
                </button>
              </form>
            </>
          ) : null}
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
