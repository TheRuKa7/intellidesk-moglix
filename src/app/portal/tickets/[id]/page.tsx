import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Banner, PageHeader, SlaMeter, StatusPill } from '@/components/ui';
import { canViewTicket, requireRequesterOrRedirect, requireTicketAccessOrNotFound } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { addMessage, getTicketById } from '@/lib/tickets';

async function reply(formData: FormData) {
  'use server';
  const user = await requireRequesterOrRedirect();
  const ticketId = Number(formData.get('ticket_id'));
  await requireTicketAccessOrNotFound(user, ticketId);
  addMessage({
    ticketId,
    authorId: user.id,
    body: String(formData.get('body')),
    type: 'public',
    actorId: user.id,
  });
  redirect(`/portal/tickets/${ticketId}`);
}

export default async function PortalTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await requireRequesterOrRedirect();
  const { id } = await params;
  const sp = await searchParams;
  const ticket = getTicketById(Number(id));
  if (!ticket || !canViewTicket(user, ticket as never)) notFound();

  const publicMessages = (ticket.messages as { type: string }[]).filter((m) => m.type === 'public');
  const attachments = ticket.attachments as { filename: string }[];

  return (
    <div>
      {sp.created === '1' ? (
        <Banner variant="success">
          Ticket <strong>{ticket.display_number as string}</strong> created. A confirmation email has been queued.
        </Banner>
      ) : null}
      <PageHeader
        title={ticket.subject as string}
        description={`${ticket.display_number as string} · ${ticket.support_team as string}`}
        backHref="/portal/tickets"
        backLabel="My requests"
      />
      <div className="workbench">
        <div className="workbench-main">
          <div className="card">
            <StatusPill
              status={ticket.status.name}
              forRequester
              breached={!!ticket.sla_breached}
            />
            <div className="thread" style={{ marginTop: 16 }}>
              {publicMessages.map((m: Record<string, unknown>) => (
                <div key={m.id as number} className="msg public">
                  <div className="meta">
                    {(m.author_name as string) ?? 'System'} · {formatDateTime(m.created_at as string)}
                  </div>
                  <div className="body">{m.body as string}</div>
                </div>
              ))}
            </div>
            {!['Closed'].includes(ticket.status.name) ? (
              <form action={reply} style={{ marginTop: 16 }}>
                <input type="hidden" name="ticket_id" value={ticket.id as number} />
                <label htmlFor="body">Your reply</label>
                <textarea id="body" name="body" required placeholder="Add more details or answer agent questions…" />
                <button className="btn" type="submit">
                  Send reply
                </button>
              </form>
            ) : (
              <p className="field-hint">This ticket is closed. Contact support to reopen.</p>
            )}
          </div>
        </div>
        <aside className="workbench-side">
          <div className="card">
            <h3 className="card-title">Details</h3>
            <p>
              <span className="field-label">Group</span>
              {ticket.group_name as string}
            </p>
            <p>
              <span className="field-label">Source</span>
              {ticket.source as string}
            </p>
            {ticket.cc ? (
              <p>
                <span className="field-label">CC</span>
                {ticket.cc as string}
              </p>
            ) : null}
            {ticket.other_remarks ? (
              <p>
                <span className="field-label">Remarks</span>
                {ticket.other_remarks as string}
              </p>
            ) : null}
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
          </div>
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
          </div>
        </aside>
      </div>
    </div>
  );
}
