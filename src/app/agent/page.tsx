import Link from 'next/link';
import { EmptyState, PageHeader, StatCard, StatusPill } from '@/components/ui';
import { requireStaffOrRedirect } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { agentPickupAction } from '@/lib/ticket-actions';
import { listTickets, runAutoCloseJob } from '@/lib/tickets';

export default async function AgentQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    mine?: string;
    overdue?: string;
    sort?: string;
  }>;
}) {
  const user = await requireStaffOrRedirect();
  runAutoCloseJob();
  const sp = await searchParams;
  const scopeGroup = user.role === 'agent' ? user.group_name : undefined;
  const tickets = listTickets({
    groupName: scopeGroup ?? undefined,
    assigneeId: sp.mine === '1' ? user.id : undefined,
    statusName: sp.status || undefined,
    search: sp.q,
    overdueOnly: sp.overdue === '1',
    sortBy: sp.sort === 'updated' ? 'updated_at' : 'created_at',
    sortDir: 'desc',
  });

  const openCount = tickets.filter((t) => t.status_category !== 'done').length;
  const mineCount = tickets.filter((t) => t.assignee_id === user.id).length;

  return (
    <div>
      <PageHeader
        title="Agent queue"
        description={user.group_name ? `${user.group_name} · pilot group` : 'All groups'}
        actions={
          <Link className="btn btn-ghost btn-sm" href="/mail">
            Mail simulator
          </Link>
        }
      />
      <div className="grid-stats" style={{ marginBottom: 24 }}>
        <StatCard label="In queue" value={openCount} />
        <StatCard label="Assigned to me" value={mineCount} />
        <StatCard label="Total visible" value={tickets.length} />
      </div>
      <form className="filter-bar" method="get">
        <div className="field">
          <label htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={sp.q ?? ''} placeholder="Ticket, subject, requester" />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ''}>
            <option value="">All statuses</option>
            <option value="Open">Open</option>
            <option value="Pending">Pending</option>
            <option value="Re-Open">Re-Open</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort">Sort</label>
          <select id="sort" name="sort" defaultValue={sp.sort ?? 'created'}>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
          </select>
        </div>
        <div className="field" style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
            <input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === '1'} />
            Mine only
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
            <input type="checkbox" name="overdue" value="1" defaultChecked={sp.overdue === '1'} />
            Overdue
          </label>
        </div>
        <button className="btn btn-ghost btn-sm" type="submit">
          Filter
        </button>
      </form>
      <div className="card" style={{ padding: 0 }}>
        {tickets.length === 0 ? (
          <EmptyState title="Queue is clear" description="No tickets match your filters." />
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Subject</th>
                  <th>Requester</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>SLA</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id as number}>
                    <td>
                      <Link href={`/agent/tickets/${t.id}`}>{t.display_number as string}</Link>
                    </td>
                    <td>{t.subject as string}</td>
                    <td>{t.requester_name as string}</td>
                    <td>
                      <StatusPill status={t.status_name as string} breached={!!t.sla_breached} />
                    </td>
                    <td>{(t.assignee_name as string) ?? '—'}</td>
                    <td>{t.sla_breached ? <span className="pill pill-breach">Breached</span> : 'On track'}</td>
                    <td className="tabular-nums">{formatDateTime(t.updated_at as string)}</td>
                    <td>
                      {!t.assignee_id ? (
                        <form action={agentPickupAction}>
                          <input type="hidden" name="ticket_id" value={t.id as number} />
                          <button className="btn btn-ghost btn-sm" type="submit">
                            Pick up
                          </button>
                        </form>
                      ) : null}
                    </td>
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
