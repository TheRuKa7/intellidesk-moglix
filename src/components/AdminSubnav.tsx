import Link from 'next/link';
import { NavLink } from '@/components/NavLink';
import { userCan, type UserRole } from '@/lib/auth';
import type { UserRow } from '@/lib/db';
import type { PrivilegeKey } from '@/lib/privileges';

type AdminLink = {
  href: string;
  label: string;
  priv: PrivilegeKey;
  roles?: UserRole[];
  group: string;
};

const ADMIN_LINKS: AdminLink[] = [
  { href: '/admin', label: 'Overview', priv: 'admin.users', group: 'Workspace' },
  { href: '/admin/agents', label: 'Agents', priv: 'admin.users', group: 'People' },
  { href: '/admin/requesters', label: 'Requesters', priv: 'admin.users', group: 'People' },
  { href: '/admin/groups', label: 'Groups', priv: 'admin.groups', group: 'People' },
  { href: '/admin/departments', label: 'Departments', priv: 'admin.users', group: 'People' },
  { href: '/admin/privileges', label: 'Roles', priv: 'admin.privileges', group: 'People' },
  { href: '/admin/mailboxes', label: 'Mailboxes', priv: 'admin.mailboxes', group: 'Channels' },
  { href: '/admin/spam', label: 'Spam', priv: 'admin.mailboxes', group: 'Channels' },
  { href: '/mail', label: 'Inbound test', priv: 'admin.mailboxes', group: 'Channels' },
  {
    href: '/admin/notifications',
    label: 'Notifications',
    priv: 'admin.settings',
    roles: ['admin'],
    group: 'Channels',
  },
  {
    href: '/admin/settings',
    label: 'Locale',
    priv: 'admin.settings',
    roles: ['admin'],
    group: 'Settings',
  },
  {
    href: '/admin/security',
    label: 'Security',
    priv: 'admin.security',
    roles: ['admin'],
    group: 'Settings',
  },
  { href: '/admin/sla', label: 'SLA', priv: 'admin.settings', group: 'Settings' },
  { href: '/admin/observability', label: 'Platform', priv: 'admin.settings', group: 'Settings' },
];

export function AdminSubnav({ user }: { user: UserRow }) {
  const links = ADMIN_LINKS.filter((l) => {
    if (l.roles && !l.roles.includes(user.role as UserRole)) return false;
    return userCan(user, l.priv);
  });
  const groups = [...new Set(links.map((l) => l.group))];

  return (
    <nav className="admin-subnav" aria-label="Admin modules">
      {groups.map((group) => (
        <div key={group} className="admin-subnav-group" role="presentation">
          <span className="admin-subnav-group-label">{group}</span>
          {links
            .filter((l) => l.group === group)
            .map((l) =>
              l.href === '/admin' ? (
                <NavLink
                  key={l.href}
                  href={l.href}
                  className="admin-subnav-link"
                  activeClassName="active"
                  exact
                >
                  {l.label}
                </NavLink>
              ) : (
                <NavLink
                  key={l.href}
                  href={l.href}
                  className="admin-subnav-link"
                  activeClassName="active"
                >
                  {l.label}
                </NavLink>
              ),
            )}
        </div>
      ))}
      <Link href="/agent" className="admin-subnav-link admin-subnav-exit">
        ← Desk
      </Link>
    </nav>
  );
}
