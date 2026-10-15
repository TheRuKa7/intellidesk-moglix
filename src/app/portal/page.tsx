import Link from 'next/link';
import { requireRequesterOrRedirect } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { listTickets } from '@/lib/tickets';
import { EmptyState, StatCard, StatusPill } from '@/components/ui';

/** MVP portal home (MFI-049). No Phase 2 catalog/KB or Phase 4 onboarding teasers. */
const QUICK_ACTIONS = [
  {
    href: '/portal/new',
    title: 'Report an incident',
    desc: 'Describe an issue and get a ticket number right away.',
    accent: 'portal-action-red',
    primary: true,
  },
  {
    href: '/portal/tickets?tab=open',
    title: 'My requests',
    desc: 'Track open tickets and reply to the support team.',
    accent: 'portal-action-navy',
    primary: false,
  },
];

export default async function PortalHome() {
  const user = await requireRequesterOrRedirect();
  const all = listTickets({ requesterId: user.id });
  const open = all.filter((t) => t.status_category !== 'done');
  const recent = all.slice(0, 5);
  const firstName = user.name.split(' ')[0] || user.name;

  return (
    <div className="portal-home">
      <section className="portal-hero">
        <p className="portal-hero-eyebrow">Moglix support</p>
        <h1 className="portal-hero-title">Hello, {firstName}</h1>
        <p className="portal-hero-lead">
          Search your tickets or report a new incident — tracked end to end with email updates.
        </p>
        <form className="portal-hero-search" action="/portal/tickets" method="get">
          <input type="hidden" name="tab" value="open" />
          <label htmlFor="portal-home-q" className="sr-only">
            Search my requests
          </label>
          <input
            id="portal-home-q"
            name="q"
            type="search"
            placeholder="Search my tickets by subject or INC number…"
            autoComplete="off"
          />
          <button type="submit" className="btn portal-submit">
            Search
          </button>
        </form>
      </section>

      <div className="grid-stats portal-stats">
        <Link href="/portal/tickets?tab=open" className="stat-card-link">
          <StatCard label="Open requests" value={open.length} />
        </Link>
        <Link href="/portal/tickets?tab=closed" className="stat-card-link">
          <StatCard label="Closed requests" value={all.length - open.length} />
        </Link>
      </div>
      {user.department ? (
        <p className="portal-dept-line">
          Department · <strong>{user.department}</strong>
        </p>
      ) : null}

      <div className="portal-actions">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.title}
            href={a.href}
            className={`portal-action-card ${a.accent}${a.primary ? ' portal-action-primary' : ''}`}
          >
            <h3>{a.title}</h3>
            <p>{a.desc}</p>
            <span className="portal-action-arrow">→</span>
          </Link>
        ))}
      </div>

      <section className="card card-elevated">
        <div className="card-head">
          <h2 className="card-title">Recent requests</h2>
          <Link className="btn btn-ghost btn-sm" href="/portal/tickets?tab=open">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            title="No requests yet"
            description="Report an incident to get a ticket number and email confirmation."
            action={
              <Link className="btn portal-submit" href="/portal/new">
                Submit a ticket
              </Link>
            }
          />
        ) : (
          <div className="table-wrap table-wrap-flush">
            <table className="data-table portal-request-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id as number}>
                    <td>
                      <Link href={`/portal/tickets/${t.id}`} className="fs-subject">
                        <span className="fs-subject-text">{t.subject as string}</span>
                        <span className="ticket-id-sub">{t.display_number as string}</span>
                      </Link>
                    </td>
                    <td>{t.support_team as string}</td>
                    <td>
                      <StatusPill
                        status={t.status_name as string}
                        forRequester
                        breached={!!t.sla_breached}
                      />
                    </td>
                    <td className="tabular-nums muted">{formatDateTime(t.updated_at as string)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
