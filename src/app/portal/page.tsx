import Link from 'next/link';
import { requireRequesterOrRedirect } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { listTickets } from '@/lib/tickets';
import { EmptyState, PageHeader, StatCard, StatusPill } from '@/components/ui';

export default async function PortalHome() {
  const user = await requireRequesterOrRedirect();
  const all = listTickets({ requesterId: user.id });
  const open = all.filter((t) => t.status_category !== 'done');
  const recent = all.slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`Hello, ${user.name.split(' ')[0]}`}
        description="Report incidents, track requests, and reply from one place."
        actions={
          <Link className="btn" href="/portal/new">
            Report an incident
          </Link>
        }
      />
      <div className="grid-stats" style={{ marginBottom: 24 }}>
        <StatCard label="Open requests" value={open.length} />
        <StatCard label="Total requests" value={all.length} />
        <StatCard label="Department" value={user.department ?? '—'} />
      </div>
      <div className="card">
        <div className="page-actions" style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            Recent requests
          </h2>
          <Link className="btn btn-ghost btn-sm" href="/portal/tickets">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            title="No requests yet"
            description="When you report an incident, it will appear here with status updates."
            action={
              <Link className="btn" href="/portal/new">
                Report an incident
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
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
                      <Link href={`/portal/tickets/${t.id}`}>{t.display_number as string}</Link>
                    </td>
                    <td>{t.subject as string}</td>
                    <td>{t.support_team as string}</td>
                    <td>
                      <StatusPill status={t.status_name as string} forRequester breached={!!t.sla_breached} />
                    </td>
                    <td className="tabular-nums">{formatDateTime(t.updated_at as string)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
