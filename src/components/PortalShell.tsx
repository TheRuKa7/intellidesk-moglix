import Link from 'next/link';
import { Suspense } from 'react';
import { getSessionUser } from '@/lib/auth';
import { logout } from '@/lib/actions';
import { NavLink } from '@/components/NavLink';
import { UserAvatar } from '@/components/ui';

/** MVP portal chrome only (MFI-049–052). Later-phase nav teasers are omitted. */
export async function PortalShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  const NAV = [
    { href: '/portal', label: 'Home', exact: true },
    { href: '/portal/tickets', label: 'Tickets' },
  ];

  return (
    <div className="app app-customer fs-portal">
      <header className="portal-header">
        <div className="portal-brand-bar">
          <div className="portal-header-inner">
            <Link href="/portal" className="portal-logo">
              <span className="portal-logo-mark">moglix</span>
              <span className="portal-logo-divider" />
              <span className="portal-logo-sub">IntelliDesk</span>
            </Link>
            {user ? (
              <div className="portal-header-right">
                <span className="portal-user-pill">
                  <UserAvatar name={user.name} />
                  {user.name}
                </span>
                <form action={logout}>
                  <button type="submit" className="btn btn-ghost btn-sm portal-signout">
                    Sign out
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
        <nav className="portal-nav" aria-label="Portal">
          <div className="portal-nav-inner">
            <Suspense fallback={<div className="portal-nav-links" />}>
              <div className="portal-nav-links">
                {NAV.map((n) => (
                  <NavLink
                    key={n.href}
                    href={n.href}
                    className="portal-nav-link"
                    activeClassName="active"
                    exact={n.exact}
                  >
                    {n.label}
                  </NavLink>
                ))}
              </div>
            </Suspense>
            <Link href="/portal/new" className="portal-nav-cta">
              Submit a ticket
            </Link>
          </div>
        </nav>
      </header>
      <main className="main main-portal">{children}</main>
    </div>
  );
}
