import Link from 'next/link';
import { Suspense } from 'react';
import { getSessionUser, getStaffHome, userCan } from '@/lib/auth';
import { logout } from '@/lib/actions';
import { DeskSearch } from '@/components/DeskSearch';
import { NavLink } from '@/components/NavLink';
import { SearchHotkey } from '@/components/SearchHotkey';
import { listNotifications } from '@/lib/platform';

const ICONS = {
  tickets: (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden fill="currentColor">
      <path d="M3.5 4A1.5 1.5 0 015 2.5h10A1.5 1.5 0 0116.5 4v2.1a2.5 2.5 0 000 4.8V14a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 14v-3.1a2.5 2.5 0 000-4.8V4zM5 4v1.6a4 4 0 000 7.8V14h10v-1.6a4 4 0 000-7.8V4H5z" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden fill="currentColor">
      <path d="M10 2l1.2 2.6L14 5.5l-2.2 1.7.7 2.8L10 8.7 7.5 10l.7-2.8L6 5.5l2.8-.9L10 2zm-7 12.5h14V16H3v-1.5zM4.5 11h11v1.5h-11V11z" />
    </svg>
  ),
  alerts: (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden fill="currentColor">
      <path d="M10 2a6 6 0 016 6v2.2l1.5 3A1 1 0 0116.6 15H3.4a1 1 0 01-.9-1.8L4 10.2V8a6 6 0 016-6zm0 15a2.2 2.2 0 01-2-1.3h4a2.2 2.2 0 01-2 1.3z" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden fill="currentColor">
      <path d="M8.5 3a5.5 5.5 0 014.2 9l3.1 3.2-1.1 1.1-3.2-3.1A5.5 5.5 0 118.5 3zm0 1.5a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  ),
};

export async function DeskShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) return children;

  const unread = listNotifications(user.id, true).length;
  const showAdmin =
    (user.role === 'supervisor' || user.role === 'admin') && userCan(user, 'admin.users');

  return (
    <div className="app app-desk app-shell fs-desk">
      <SearchHotkey />
      <aside className="desk-sidebar" aria-label="Agent navigation">
        <Link href={getStaffHome(user)} className="brand brand-compact">
          <span className="brand-mark desk">m</span>
          <span>
            <span className="brand-text">IntelliDesk</span>
            <span className="brand-sub light">Moglix service desk</span>
          </span>
        </Link>
        <nav className="desk-nav">
          <Suspense fallback={<div className="desk-nav-group" />}>
            <div className="desk-nav-group">
              <NavLink href="/agent" className="desk-nav-link" activeClassName="active" exact={false}>
                <span className="desk-nav-icon">{ICONS.tickets}</span>
                <span className="desk-nav-label">Tickets</span>
              </NavLink>
              <div className="desk-nav-sub">
                <NavLink href="/agent?view=open" className="desk-nav-sublink" activeClassName="active">
                  Open
                </NavLink>
                <NavLink href="/agent?view=mine" className="desk-nav-sublink" activeClassName="active">
                  My tickets
                </NavLink>
                <NavLink
                  href="/agent?view=overdue"
                  className="desk-nav-sublink"
                  activeClassName="active"
                >
                  Overdue
                </NavLink>
                <NavLink
                  href="/agent?view=unassigned"
                  className="desk-nav-sublink"
                  activeClassName="active"
                >
                  Unassigned
                </NavLink>
              </div>
            </div>
          </Suspense>

          {showAdmin ? (
            <Suspense fallback={null}>
              <NavLink href="/admin" className="desk-nav-link" activeClassName="active">
                <span className="desk-nav-icon">{ICONS.admin}</span>
                <span className="desk-nav-label">Admin</span>
              </NavLink>
            </Suspense>
          ) : null}
        </nav>
        <div className="desk-sidebar-foot">
          <div className="desk-user-card">
            <UserAvatar name={user.name} />
            <div>
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.role}</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="desk-main">
        <header className="desk-topbar">
          <Suspense fallback={<div className="desk-search" aria-hidden />}>
            <DeskSearch />
          </Suspense>
          <div className="desk-topbar-actions">
            {user.group_name ? <span className="desk-pilot-badge">{user.group_name}</span> : null}
            <Link href="/agent/new" className="btn btn-sm btn-desk-create">
              + New ticket
            </Link>
            <Link
              href="/notifications"
              className="desk-bell"
              title="Notifications"
              aria-label={`Alerts${unread ? `, ${unread} unread` : ''}`}
            >
              <span className="desk-nav-icon">{ICONS.alerts}</span>
              {unread > 0 ? <span className="nav-badge">{unread > 9 ? '9+' : unread}</span> : null}
            </Link>
            <form action={logout}>
              <button type="submit" className="btn btn-ghost btn-sm btn-desk-ghost">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="main main-desk">{children}</main>
      </div>
    </div>
  );
}

function UserAvatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`
      : (parts[0]?.slice(0, 2) ?? '?');
  return <span className="user-avatar user-avatar-lg">{initials.toUpperCase()}</span>;
}
