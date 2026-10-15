import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { requireStaffRoleOrRedirect, userCan } from '@/lib/auth';

const MODULES = [
  {
    href: '/admin/agents',
    label: 'Agents',
    desc: 'Create and manage staff',
    priv: 'admin.users' as const,
    group: 'User management',
    icon: 'agents',
  },
  {
    href: '/admin/requesters',
    label: 'Requesters',
    desc: 'Portal users and lifecycle',
    priv: 'admin.users' as const,
    group: 'User management',
    icon: 'requesters',
  },
  {
    href: '/admin/groups',
    label: 'Agent groups',
    desc: 'Create queues',
    priv: 'admin.groups' as const,
    group: 'User management',
    icon: 'groups',
  },
  {
    href: '/admin/departments',
    label: 'Departments',
    desc: 'Create departments and approvers',
    priv: 'admin.users' as const,
    group: 'User management',
    icon: 'depts',
  },
  {
    href: '/admin/privileges',
    label: 'Roles & privileges',
    desc: 'Create roles and privileges',
    priv: 'admin.privileges' as const,
    group: 'User management',
    icon: 'roles',
  },
  {
    href: '/admin/mailboxes',
    label: 'Mailboxes',
    desc: 'Create inbound addresses',
    priv: 'admin.mailboxes' as const,
    group: 'Channels',
    icon: 'mail',
  },
  {
    href: '/admin/spam',
    label: 'Spam quarantine',
    desc: 'Blocked inbound · release',
    priv: 'admin.mailboxes' as const,
    group: 'Channels',
    icon: 'spam',
  },
  {
    href: '/mail',
    label: 'Inbound test',
    desc: 'Simulate mailbox ingest for pilot QA',
    priv: 'admin.mailboxes' as const,
    group: 'Channels',
    icon: 'lab',
  },
  {
    href: '/admin/notifications',
    label: 'Email notifications',
    desc: 'Lifecycle event toggles',
    priv: 'admin.settings' as const,
    group: 'Channels',
    icon: 'notify',
  },
  {
    href: '/admin/settings',
    label: 'Service desk settings',
    desc: 'Locale, timezone, ticket ID',
    priv: 'admin.settings' as const,
    group: 'Account settings',
    icon: 'settings',
  },
  {
    href: '/admin/security',
    label: 'Security',
    desc: 'Sessions, domains, attachments',
    priv: 'admin.security' as const,
    group: 'Account settings',
    icon: 'security',
  },
  {
    href: '/admin/sla',
    label: 'SLA policies',
    desc: 'Response and resolve targets',
    priv: 'admin.settings' as const,
    group: 'Account settings',
    icon: 'sla',
  },
  {
    href: '/admin/observability',
    label: 'Platform events',
    desc: 'Health metrics and recent system events',
    priv: 'admin.settings' as const,
    group: 'Platform',
    icon: 'obs',
  },
];

function TileIcon({ name }: { name: string }) {
  const common = { viewBox: '0 0 20 20', width: 20, height: 20, fill: 'currentColor', 'aria-hidden': true as const };
  switch (name) {
    case 'agents':
      return (
        <svg {...common}>
          <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
        </svg>
      );
    case 'requesters':
      return (
        <svg {...common}>
          <path d="M7 8a3 3 0 116 0 3 3 0 01-6 0zm8 1a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3 17a6 6 0 0112 0H3zm12.5-1a5 5 0 014.5 1h-4.2a6.9 6.9 0 00-.3-1z" />
        </svg>
      );
    case 'groups':
      return (
        <svg {...common}>
          <path d="M3 4h6v6H3V4zm8 0h6v6h-6V4zM3 12h6v6H3v-6zm8 0h6v6h-6v-6z" />
        </svg>
      );
    case 'depts':
      return (
        <svg {...common}>
          <path d="M4 3h12v14H4V3zm2 2v2h8V5H6zm0 4v2h8V9H6zm0 4v2h5v-2H6z" />
        </svg>
      );
    case 'roles':
      return (
        <svg {...common}>
          <path d="M10 2l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4l2-4z" />
        </svg>
      );
    case 'mail':
    case 'lab':
      return (
        <svg {...common}>
          <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm2 0l6 4.5L16 5H4z" />
        </svg>
      );
    case 'spam':
      return (
        <svg {...common}>
          <path d="M10 2l8 4v5c0 4-3.5 7-8 8-4.5-1-8-4-8-8V6l8-4zm0 4v6m0 2v1" />
        </svg>
      );
    case 'notify':
      return (
        <svg {...common}>
          <path d="M10 2a6 6 0 016 6v2.3l1.4 2.8A1 1 0 0116.5 15H3.5a1 1 0 01-.9-1.9L4 10.3V8a6 6 0 016-6z" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <path d="M8 2h4l.5 2.2a6 6 0 011.5.9L16 4.5 18 7l-1.6 1.2c.1.5.1 1 .1 1.5s0 1-.1 1.5L18 13l-2 2.5-2-1.6a6 6 0 01-1.5.9L12 18H8l-.5-2.2a6 6 0 01-1.5-.9L4 15.5 2 13l1.6-1.2A8 8 0 013.5 10c0-.5 0-1 .1-1.5L2 7l2-2.5 2 1.6a6 6 0 011.5-.9L8 2zm2 5a3 3 0 100 6 3 3 0 000-6z" />
        </svg>
      );
    case 'security':
      return (
        <svg {...common}>
          <path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5l7-3z" />
        </svg>
      );
    case 'sla':
      return (
        <svg {...common}>
          <path d="M10 2a8 8 0 110 16 8 8 0 010-16zm1 4H9v5l4 2 .9-1.5L11 10V6z" />
        </svg>
      );
    case 'obs':
      return (
        <svg {...common}>
          <path d="M3 14h3v-4H3v4zm5 0h3V6H8v8zm5 0h3V9h-3v5z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M4 4h12v12H4V4z" />
        </svg>
      );
  }
}

export default async function AdminHomePage() {
  const user = await requireStaffRoleOrRedirect(['admin', 'supervisor']);
  const visible = MODULES.filter((m) => userCan(user, m.priv));
  const groups = [...new Set(visible.map((m) => m.group))];

  return (
    <div className="fs-admin-home">
      <PageHeader
        title="Admin"
        description="Manage people, channels, and workspace settings for IntelliDesk."
        backHref="/agent"
        backLabel="Tickets"
      />
      {groups.map((group) => (
        <section key={group} className="fs-admin-section">
          <h2 className="fs-admin-section-title">{group}</h2>
          <div className="fs-admin-grid">
            {visible
              .filter((m) => m.group === group)
              .map((m) => (
                <Link key={m.href} href={m.href} className="fs-admin-tile">
                  <span className="fs-admin-tile-icon">
                    <TileIcon name={m.icon} />
                  </span>
                  <span className="fs-admin-tile-label">{m.label}</span>
                  <span className="fs-admin-tile-desc">{m.desc}</span>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
