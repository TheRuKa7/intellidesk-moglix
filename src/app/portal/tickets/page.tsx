import Link from 'next/link';
import { requireRequesterOrRedirect } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { exportTicketsCsv, listTickets } from '@/lib/tickets';
import { EmptyState, PageHeader, StatusPill } from '@/components/ui';

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string; tab?: string }>;
}) {
  const user = await requireRequesterOrRedirect();
  const sp = await searchParams;
  const tab = sp.tab === 'closed' ? 'closed' : 'open';
  const sortBy = sp.sort === 'updated' ? 'updated_at' : 'created_at';
  const all = listTickets({
    requesterId: user.id,
    search: sp.q,
    sortBy,
    sortDir: 'desc',
  });
  const openCount = all.filter((t) => t.status_category !== 'done').length;
  const closedCount = all.filter((t) => t.status_category === 'done').length;
  const tickets = all.filter((t) =>
    tab === 'closed' ? t.status_category === 'done' : t.status_category !== 'done',
  );
  const csv = exportTicketsCsv(tickets);
  const q = sp.q ? `&q=${encodeURIComponent(sp.q)}` : '';
  const sort = sp.sort ? `&sort=${sp.sort}` : '';

  return (
    <div>
      <PageHeader
        title="My requests"
        description="Open tickets need attention; closed tickets stay searchable for history."
        actions={
          <div className="page-actions">
            <Link className="btn portal-submit btn-sm" href="/portal/new">
              Submit a ticket
            </Link>
            <a
              className="btn btn-ghost btn-sm"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
              download="my-requests.csv"
            >
              Export CSV
            </a>
          </div>
        }
      />
      <div className="saved-views" role="tablist" aria-label="Request status" style={{ marginBottom: 12 }}>
        <Link
          href={`/portal/tickets?tab=open${q}${sort}`}
          className={`saved-view-tab${tab === 'open' ? ' active' : ''}`}
        >
          Open ({openCount})
        </Link>
        <Link
          href={`/portal/tickets?tab=closed${q}${sort}`}
          className={`saved-view-tab${tab === 'closed' ? ' active' : ''}`}
        >
          Closed ({closedCount})
        </Link>
      </div>
      <form className="filter-bar portal-filter-bar" method="get">
        <input type="hidden" name="tab" value={tab} />
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
        <button className="btn portal-submit btn-sm" type="submit">
          Apply
        </button>
      </form>
      <div className="card card-elevated" style={{ padding: 0 }}>
        {tickets.length === 0 ? (
          <EmptyState
            title={tab === 'closed' ? 'No closed requests' : 'No open requests'}
            description={
              tab === 'closed'
                ? 'Resolved and closed tickets will appear here.'
                : 'Try a different search or report a new incident.'
            }
            action={
              tab === 'open' ? (
                <Link className="btn portal-submit" href="/portal/new">
                  Submit a ticket
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="table-wrap table-wrap-flush">
              <table className="data-table portal-request-table">
                <thead>
                  <tr>
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
                      <td className="tabular-nums">{formatDateTime(t.created_at as string)}</td>
                      <td className="tabular-nums">{formatDateTime(t.updated_at as string)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="fs-pagination" style={{ padding: '12px 16px' }}>
              <span>
                Showing all {tickets.length} {tab} request{tickets.length === 1 ? '' : 's'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
