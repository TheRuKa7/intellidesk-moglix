import Link from 'next/link';
import { requireRequesterOrRedirect } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { exportTicketsCsv, listTickets } from '@/lib/tickets';
import { EmptyState, PageHeader, StatusPill } from '@/components/ui';

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string }>;
}) {
  const user = await requireRequesterOrRedirect();
  const sp = await searchParams;
  const sortBy = sp.sort === 'updated' ? 'updated_at' : 'created_at';
  const tickets = listTickets({
    requesterId: user.id,
    search: sp.q,
    sortBy,
    sortDir: 'desc',
  });
  const csv = exportTicketsCsv(tickets);

  return (
    <div>
      <PageHeader
        title="My requests"
        description="Track open and past tickets. Reply on any ticket to continue the conversation."
        backHref="/portal"
        backLabel="Portal home"
        actions={
          <>
            <a
              className="btn btn-ghost btn-sm"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
              download="my-requests.csv"
            >
              Export CSV
            </a>
            <Link className="btn btn-sm" href="/portal/new">
              New incident
            </Link>
          </>
        }
      />
      <form className="filter-bar" method="get">
        <div className="field">
          <label htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={sp.q ?? ''} placeholder="Ticket # or subject" />
        </div>
        <div className="field">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" name="sort" defaultValue={sp.sort ?? 'created'}>
            <option value="created">Created date</option>
            <option value="updated">Last updated</option>
          </select>
        </div>
        <button className="btn btn-ghost btn-sm" type="submit">
          Apply
        </button>
      </form>
      <div className="card" style={{ padding: 0 }}>
        {tickets.length === 0 ? (
          <EmptyState
            title="No matching requests"
            description="Try a different search or report a new incident."
            action={
              <Link className="btn" href="/portal/new">
                Report an incident
              </Link>
            }
          />
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Subject</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id as number}>
                    <td>
                      <Link href={`/portal/tickets/${t.id}`}>{t.display_number as string}</Link>
                    </td>
                    <td>{t.subject as string}</td>
                    <td>{t.support_team as string}</td>
                    <td>
                      <StatusPill status={t.status_name as string} forRequester breached={!!t.sla_breached} />
                    </td>
                    <td className="tabular-nums">{formatDateTime(t.created_at as string)}</td>
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
