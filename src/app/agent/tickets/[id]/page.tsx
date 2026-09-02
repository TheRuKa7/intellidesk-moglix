import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MessageComposer } from '@/components/MessageComposer';
import { PageHeader, SlaMeter, StatusPill } from '@/components/ui';
import { canViewTicket, requireStaffOrRedirect } from '@/lib/auth';
import { COMMERCE_FIELDS, STATUSES } from '@/lib/constants';
import { getAuditForTicket } from '@/lib/audit';
import { getDb } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { agentReplyAction, agentUpdateTicketAction } from '@/lib/ticket-actions';
import { getTicketById } from '@/lib/tickets';

const STATUS_GROUPS = [
  { label: 'In progress', names: ['Open', 'Re-Open'] },
  { label: 'Waiting on requester', names: ['Pending'] },
  {
    label: 'Waiting on approval',
    names: [
      'Manager Approval Awaited',
      'BU Approval Awaited',
      'Finance Approval Awaited',
      'Treasury Approval Awaited',
      'Supply Approval Awaited',
    ],
  },
  {
    label: 'Waiting on team',
    names: [
      'Waiting for Tech',
      'Waiting for catalog',
      'Pushed to SCM',
      'Plant Creation Action',
      'CL Action Awaited',
      'On Hold',
    ],
  },
  { label: 'Done', names: ['Resolved', 'Interim Resolve', 'Closed'] },
];

export default async function AgentTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireStaffOrRedirect();
  const { id } = await params;
  const sp = await searchParams;
  const ticket = getTicketById(Number(id));
  if (!ticket || !canViewTicket(user, ticket as never)) notFound();

  const agents = getDb()
    .prepare("SELECT id, name FROM users WHERE role IN ('agent', 'supervisor', 'admin') AND active = 1")
    .all() as { id: number; name: string }[];
  const activity = getAuditForTicket(ticket.id as number);
  const customFields = ticket.custom_fields as Record<string, string>;
  const attachments = ticket.attachments as { filename: string }[];

  return (
    <div>
      {sp.saved === '1' ? (
        <div className="banner banner-success">Ticket updated successfully.</div>
      ) : null}
      {sp.error === 'resolution' ? (
        <div className="banner banner-warn">Resolution note is required when resolving a ticket.</div>
      ) : null}
      <PageHeader
        title={ticket.subject as string}
        description={`${ticket.display_number as string} · ${(ticket.requester as { name: string }).name}`}
        backHref="/agent"
        backLabel="Queue"
        actions={<StatusPill status={ticket.status.name} breached={!!ticket.sla_breached} />}
      />
      <div className="workbench">
        <div className="workbench-main">
          <div className="card">
            <h3 className="card-title">Conversation</h3>
            <div className="thread">
              {(ticket.messages as Record<string, unknown>[]).map((m) => (
                <div key={m.id as number} className={`msg ${m.type === 'note' ? 'note' : 'public'}`}>
                  <div className="meta">
                    {(m.author_name as string) ?? 'System'} ·{' '}
                    {m.type === 'note' ? 'Internal note' : 'Public reply'} ·{' '}
                    {formatDateTime(m.created_at as string)}
                  </div>
                  <div className="body">{m.body as string}</div>
                </div>
              ))}
            </div>
            <MessageComposer ticketId={ticket.id as number} replyAction={agentReplyAction} />
          </div>
          <div className="card">
            <h3 className="card-title">Activity</h3>
            {activity.length === 0 ? (
              <p className="field-hint">No activity recorded yet.</p>
            ) : (
              <ul className="activity-list">
                {activity.map((a) => (
                  <li key={a.id as number} className="activity-item">
                    <strong>{a.action as string}</strong>
                    {a.detail ? ` — ${a.detail as string}` : ''}
                    <div className="activity-meta">
                      {(a.actor_name as string) ?? 'System'} · {formatDateTime(a.created_at as string)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <aside className="workbench-side">
          <div className="card">
            <h3 className="card-title">SLA</h3>
            <SlaMeter
              respondBy={ticket.respond_by as string | null}
              resolveBy={ticket.resolve_by as string | null}
              firstResponseAt={ticket.first_response_at as string | null}
              resolvedAt={ticket.resolved_at as string | null}
              slaClock={ticket.status.sla_clock}
              breached={!!ticket.sla_breached}
            />
            {ticket.sla_breached ? (
              <form action={agentUpdateTicketAction} style={{ marginTop: 12 }}>
                <input type="hidden" name="ticket_id" value={ticket.id as number} />
                <label htmlFor="breach_reason">Breach reason</label>
                <input
                  id="breach_reason"
                  name="breach_reason"
                  defaultValue={(ticket.breach_reason as string) ?? ''}
                  placeholder="Why was SLA missed?"
                />
                <button className="btn btn-ghost btn-sm" type="submit">
                  Save reason
                </button>
              </form>
            ) : null}
          </div>
          <div className="card">
            <h3 className="card-title">Properties</h3>
            <form action={agentUpdateTicketAction}>
              <input type="hidden" name="ticket_id" value={ticket.id as number} />
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={ticket.status.name}>
                {STATUS_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {STATUSES.filter((s) => g.names.includes(s.name)).map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <label htmlFor="assignee_id">Assignee</label>
              <select
                id="assignee_id"
                name="assignee_id"
                defaultValue={ticket.assignee_id ? String(ticket.assignee_id) : ''}
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <label htmlFor="resolution_note">Resolution note</label>
              <textarea
                id="resolution_note"
                name="resolution_note"
                defaultValue={(ticket.resolution_note as string) ?? ''}
                placeholder="Required when resolving"
              />
              <div className="form-section">
                <h3 className="form-section-title">Commerce fields</h3>
                {COMMERCE_FIELDS.map((field) => (
                  <div key={field}>
                    <label htmlFor={field}>{field.replace(/_/g, ' ')}</label>
                    <input
                      id={field}
                      name={field}
                      defaultValue={
                        field === 'support_team'
                          ? ((ticket.support_team as string) ?? customFields[field] ?? '')
                          : (customFields[field] ?? '')
                      }
                    />
                  </div>
                ))}
              </div>
              <button className="btn" type="submit" style={{ width: '100%' }}>
                Save changes
              </button>
            </form>
          </div>
          <div className="card">
            <h3 className="card-title">Requester</h3>
            <p>{(ticket.requester as { name: string }).name}</p>
            <p className="field-hint">{(ticket.requester as { email: string }).email}</p>
            <p>
              <span className="field-label">Source</span> {ticket.source as string}
            </p>
            <p>
              <span className="field-label">Mailbox</span> {(ticket.mailbox as string) ?? '—'}
            </p>
            {attachments.length > 0 ? (
              <div>
                <span className="field-label">Attachments</span>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {attachments.map((a, i) => (
                    <li key={i}>{a.filename}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Link className="btn btn-ghost btn-sm" href="/mail" style={{ marginTop: 12 }}>
              Simulate email reply
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
