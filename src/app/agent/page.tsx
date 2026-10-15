import Link from 'next/link';
import { AGENT_SAVED_VIEWS } from '@/lib/constants';
import {
  EmptyState,
  PriorityPill,
  StatCard,
  StatusPill,
  UserAvatar,
} from '@/components/ui';
import { requireStaffOrRedirect } from '@/lib/auth';
import {
  formatDateTime,
  slaStatusPhrase,
  ticketDueBucket,
  ticketDueToday,
} from '@/lib/format';
import { agentPickupAction } from '@/lib/ticket-actions';
import { exportTicketsCsv, listTickets, runAutoCloseJob } from '@/lib/tickets';
import { searchTickets } from '@/lib/search';
import { SubmitButton } from '@/components/SubmitButton';

const DUE_OPTIONS = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Due today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'next8h', label: 'Next 8 hours' },
] as const;

export default async function AgentQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    view?: string;
    sort?: string;
    due?: string;
    filter?: string;
  }>;
}) {
  const user = await requireStaffOrRedirect();
  runAutoCloseJob();
  const sp = await searchParams;
  const view = sp.view ?? 'open';
  const due = sp.due ?? '';
  const filterTab = sp.filter === 'advanced' ? 'advanced' : 'basic';
  const scopeGroup = user.role === 'agent' ? user.group_name : undefined;

  const listFilters = {
    groupName: scopeGroup ?? undefined,
    assigneeId: view === 'mine' ? user.id : undefined,
    statusName: sp.status || undefined,
    overdueOnly: view === 'overdue' || due === 'overdue',
    unassignedOnly: view === 'unassigned',
    sortBy: (sp.sort === 'updated' ? 'updated_at' : 'created_at') as 'created_at' | 'updated_at',
    sortDir: 'desc' as const,
  };
  let tickets = (sp.q ? searchTickets(sp.q, listFilters) : listTickets(listFilters)).filter((t) => {
    if (view === 'open') return t.status_category !== 'done';
    return true;
  });

  if (view === 'due_today' || due === 'today' || due === 'tomorrow' || due === 'next8h') {
    const bucket = view === 'due_today' ? 'today' : (due as 'today' | 'tomorrow' | 'next8h');
    tickets = tickets.filter((t) => {
      const b = ticketDueBucket({
        statusCategory: t.status_category as string,
        slaClock: t.sla_clock as string,
        respondBy: t.respond_by as string | null,
        resolveBy: t.resolve_by as string | null,
        firstResponseAt: t.first_response_at as string | null,
        resolvedAt: t.resolved_at as string | null,
      });
      if (bucket === 'today') return b === 'today';
      if (bucket === 'tomorrow') return b === 'tomorrow';
      if (bucket === 'next8h') return b === 'next8h' || b === 'today';
      return false;
    });
  }

  const openPool = listTickets({
    groupName: scopeGroup ?? undefined,
  }).filter((t) => t.status_category !== 'done');

  const openCount = openPool.length;
  const mineCount = openPool.filter((t) => t.assignee_id === user.id).length;
  const overdueCount = openPool.filter((t) => {
    const phrase = slaStatusPhrase({
      statusName: t.status_name as string,
      statusCategory: t.status_category as string,
      slaClock: t.sla_clock as string,
      respondBy: t.respond_by as string | null,
      resolveBy: t.resolve_by as string | null,
      firstResponseAt: t.first_response_at as string | null,
      resolvedAt: t.resolved_at as string | null,
      slaBreached: !!t.sla_breached,
    });
    return phrase === 'Overdue';
  }).length;
  const dueTodayCount = openPool.filter((t) =>
    ticketDueToday({
      statusCategory: t.status_category as string,
      slaClock: t.sla_clock as string,
      respondBy: t.respond_by as string | null,
      resolveBy: t.resolve_by as string | null,
      firstResponseAt: t.first_response_at as string | null,
      resolvedAt: t.resolved_at as string | null,
    }),
  ).length;

  const csv = exportTicketsCsv(tickets);
  const viewLabel = AGENT_SAVED_VIEWS.find((v) => v.id === view)?.label ?? 'Tickets';

  return (
    <div className="fs-queue">
      <div className="fs-queue-toolbar">
        <div className="fs-queue-title-block">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <span className="breadcrumb-item">Tickets</span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-item">{viewLabel}</span>
          </nav>
          <h1 className="fs-queue-title">{viewLabel}</h1>
          <p className="page-desc" style={{ marginTop: 4 }}>
            Dense queue with SLA status details — pick up, filter, and open tickets without leaving the list.
          </p>
        </div>
        <div className="fs-queue-toolbar-actions">
          <a
            className="btn btn-ghost btn-sm"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
            download="intellidesk-queue.csv"
          >
            Export
          </a>
          <Link className="btn btn-fs-primary btn-sm" href="/agent/new">
            + Create
          </Link>
        </div>
      </div>

      <div className="grid-stats fs-kpi-row">
        <Link href="/agent?view=open" className="stat-card-link">
          <StatCard label="Open" value={openCount} />
        </Link>
        <Link href="/agent?view=mine" className="stat-card-link">
          <StatCard label="Assigned to me" value={mineCount} />
        </Link>
        <Link href="/agent?view=due_today" className="stat-card-link">
          <StatCard
            label="Due today"
            value={dueTodayCount}
            variant={dueTodayCount > 0 ? 'alert' : 'default'}
          />
        </Link>
        <Link href="/agent?view=overdue" className="stat-card-link">
          <StatCard
            label="Overdue"
            value={overdueCount}
            variant={overdueCount > 0 ? 'alert' : 'default'}
          />
        </Link>
      </div>

      <div className="saved-views fs-saved-views" role="tablist" aria-label="Saved views">
        {AGENT_SAVED_VIEWS.map((v) => (
          <Link
            key={v.id}
            href={`/agent?view=${v.id}`}
            className={`saved-view-tab${view === v.id ? ' active' : ''}`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {sp.q || sp.status || due ? (
        <div className="fs-filter-chips" aria-label="Active filters">
          {sp.q ? <span className="pill pill-neutral">Search: {sp.q}</span> : null}
          {sp.status ? <span className="pill pill-neutral">Status: {sp.status}</span> : null}
          {due ? (
            <span className="pill pill-neutral">
              Due: {DUE_OPTIONS.find((o) => o.id === due)?.label ?? due}
            </span>
          ) : null}
          <Link className="inline-link" href={`/agent?view=${view}`}>
            Clear filters
          </Link>
        </div>
      ) : null}

      <div className="queue-layout">
        <div className="queue-main">
          <div className="card card-elevated fs-queue-card" style={{ padding: 0 }}>
            {tickets.length === 0 ? (
              <EmptyState
                title="No tickets in this view"
                description="Try another saved view, clear filters, or create a ticket on behalf of a requester."
                action={
                  <Link className="btn btn-fs-primary btn-sm" href="/agent/new">
                    + Create ticket
                  </Link>
                }
              />
            ) : (
              <div className="table-wrap table-wrap-flush fs-table-wrap">
                <table className="data-table data-table-dense fs-ticket-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Requester</th>
                      <th>Priority</th>
                      <th>Created</th>
                      <th>Status details</th>
                      <th>Status</th>
                      <th>Agent</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => {
                      const phrase = slaStatusPhrase({
                        statusName: t.status_name as string,
                        statusCategory: t.status_category as string,
                        slaClock: t.sla_clock as string,
                        respondBy: t.respond_by as string | null,
                        resolveBy: t.resolve_by as string | null,
                        firstResponseAt: t.first_response_at as string | null,
                        resolvedAt: t.resolved_at as string | null,
                        slaBreached: !!t.sla_breached,
                      });
                      const unread =
                        t.last_public_author_id != null &&
                        t.last_public_author_id === t.requester_id &&
                        t.status_category !== 'done';
                      return (
                        <tr key={t.id as number} className={unread ? 'fs-row-unread' : undefined}>
                          <td>
                            <Link
                              href={`/agent/tickets/${t.id}${view !== 'open' ? `?view=${view}` : ''}`}
                              className="ticket-subject-link fs-subject"
                            >
                              {unread ? (
                                <span className="unread-dot" title="New requester activity" />
                              ) : null}
                              <span className="fs-subject-text">{t.subject as string}</span>
                              <span className="ticket-id-sub">#{t.display_number as string}</span>
                            </Link>
                          </td>
                          <td>
                            <span className="requester-cell">
                              <UserAvatar name={t.requester_name as string} />
                              <span className="fs-requester-name">{t.requester_name as string}</span>
                            </span>
                          </td>
                          <td>
                            <PriorityPill priority={(t.priority as string) || 'Low'} />
                          </td>
                          <td className="tabular-nums fs-created">
                            {formatDateTime(t.created_at as string)}
                          </td>
                          <td className={`sla-phrase${phrase === 'Overdue' ? ' overdue' : ''}`}>
                            {phrase}
                          </td>
                          <td>
                            <StatusPill status={t.status_name as string} breached={!!t.sla_breached} />
                          </td>
                          <td className="fs-assignee">{(t.assignee_name as string) ?? '—'}</td>
                          <td>
                            {!t.assignee_id ? (
                              <form action={agentPickupAction}>
                                <input type="hidden" name="ticket_id" value={t.id as number} />
                                <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">
                                  Pick up
                                </SubmitButton>
                              </form>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="fs-pagination">
            <span>
              {tickets.length === 0
                ? 'No tickets match these filters'
                : `Showing all ${tickets.length} matching ticket${tickets.length === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>

        <aside className="queue-filter-rail fs-filter-rail" aria-label="Filter panel">
          <div className="filter-rail-tabs" role="tablist">
            <Link
              href={`/agent?view=${view}&filter=basic${due ? `&due=${due}` : ''}`}
              className={`filter-rail-tab${filterTab === 'basic' ? ' active' : ''}`}
              role="tab"
            >
              Basic
            </Link>
            <Link
              href={`/agent?view=${view}&filter=advanced`}
              className={`filter-rail-tab${filterTab === 'advanced' ? ' active' : ''}`}
              role="tab"
            >
              Saved views
            </Link>
          </div>

          {filterTab === 'basic' ? (
            <form className="filter-rail-form" method="get">
              <input type="hidden" name="view" value={view} />
              <input type="hidden" name="filter" value="basic" />
              <div className="field">
                <label htmlFor="q">Search</label>
                <input
                  id="q"
                  name="q"
                  defaultValue={sp.q ?? ''}
                  placeholder="Ticket, subject, requester"
                />
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
                <label htmlFor="sort">Created / Updated</label>
                <select id="sort" name="sort" defaultValue={sp.sort ?? 'created'}>
                  <option value="created">Created (newest)</option>
                  <option value="updated">Updated (newest)</option>
                </select>
                <p className="field-hint">Sort by created or last updated.</p>
              </div>
              <fieldset className="fs-dueby">
                <legend>Due by</legend>
                {DUE_OPTIONS.map((opt) => (
                  <label key={opt.id} className="fs-dueby-option">
                    <input
                      type="radio"
                      name="due"
                      value={opt.id}
                      defaultChecked={due === opt.id}
                    />
                    {opt.label}
                  </label>
                ))}
                <label className="fs-dueby-option">
                  <input type="radio" name="due" value="" defaultChecked={!due} />
                  Any
                </label>
              </fieldset>
              <div className="filter-rail-actions">
                <button className="btn btn-sm btn-fs-apply" type="submit">
                  Apply
                </button>
                <Link className="btn btn-ghost btn-sm" href={`/agent?view=${view}`}>
                  Clear
                </Link>
              </div>
            </form>
          ) : (
            <div className="filter-rail-advanced">
              <p className="field-hint">Jump to a saved queue view.</p>
              <ul className="filter-rail-views">
                {AGENT_SAVED_VIEWS.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/agent?view=${v.id}&filter=advanced`}
                      className={view === v.id ? 'active' : undefined}
                    >
                      {v.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
