import Link from 'next/link';
import { getSessionUser, getStaffHome } from '@/lib/auth';
import { logout } from '@/lib/actions';

export async function DeskShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) return children;

  const nav = [
    { href: '/agent', label: 'Queue', roles: ['agent', 'supervisor', 'admin'] },
    { href: '/supervisor', label: 'Reports', roles: ['supervisor', 'admin'] },
    { href: '/mail', label: 'Mail', roles: ['agent', 'supervisor', 'admin'] },
  ].filter((n) => n.roles.includes(user.role));

  return (
    <div className="app app-desk">
      <header className="topbar topbar-desk">
        <div className="topbar-left">
          <Link href={getStaffHome(user)} className="brand">
            <span className="brand-mark desk">A</span>
            <span>
              <span className="brand-text">Agent Desk</span>
              <span className="brand-sub">IntelliDesk workbench</span>
            </span>
          </Link>
          <nav className="nav" aria-label="Agent desk">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="nav-link">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="topbar-right">
          <div className="user-chip">
            <span className="user-name">{user.name}</span>
            <span className="user-role">{user.role}</span>
            {user.group_name ? <span className="user-group">{user.group_name}</span> : null}
          </div>
          <form action={logout}>
            <button type="submit" className="btn btn-ghost btn-sm">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
