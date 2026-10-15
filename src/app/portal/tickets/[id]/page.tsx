import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AttachmentCard, StatusPill } from '@/components/ui';
import { FlashBanner } from '@/components/FlashBanner';
import { MessageBody } from '@/components/MessageBody';
import { SubmitButton } from '@/components/SubmitButton';
import { canViewTicket, requireRequesterOrRedirect, requireTicketAccessOrNotFound } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { addMessage, getTicketById, isReopenStatus } from '@/lib/tickets';

async function reply(formData: FormData) {
  'use server';
  const user = await requireRequesterOrRedirect();
  const ticketId = Number(formData.get('ticket_id'));
  await requireTicketAccessOrNotFound(user, ticketId);
  const body = String(formData.get('body') ?? '').trim();
  if (!body) redirect(`/portal/tickets/${ticketId}?error=empty`);

  const before = getTicketById(ticketId);
  const wasDone = before ? isReopenStatus(before.status.name) : false;

  addMessage({
    ticketId,
    authorId: user.id,
    body,
    type: 'public',
    actorId: user.id,
  });
  redirect(`/portal/tickets/${ticketId}?notice=${wasDone ? 'reopened' : 'replied'}`);
}

export default async function PortalTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; notice?: string; error?: string }>;
}) {
  const user = await requireRequesterOrRedirect();
  const { id } = await params;
  const sp = await searchParams;
  const ticket = getTicketById(Number(id));
  if (!ticket || !canViewTicket(user, ticket as never)) notFound();

  const publicMessages = (ticket.messages as Record<string, unknown>[]).filter(
    (m) => m.type === 'public',
  );
  const attachments = ticket.attachments as {
    id: number;
    filename: string;
    size_bytes?: number | null;
    storage_key?: string | null;
  }[];
  const canReopen = isReopenStatus(ticket.status.name);
  const listTab = ticket.status_category === 'done' ? 'closed' : 'open';

  return (
    <div className="portal-ticket">
      {sp.created === '1' ? (
        <FlashBanner variant="success">
          Ticket <strong>{ticket.display_number as string}</strong> created. A confirmation email has
          been queued — keep this page for updates.
        </FlashBanner>
      ) : null}
      {sp.notice === 'replied' ? (
        <FlashBanner variant="success">Your reply was sent to the support team.</FlashBanner>
      ) : null}
      {sp.notice === 'reopened' ? (
        <FlashBanner variant="success">
          Ticket reopened and your reply was sent to the support team.
        </FlashBanner>
      ) : null}
      {sp.error === 'empty' ? (
        <FlashBanner variant="warn">Please enter a message before sending.</FlashBanner>
      ) : null}

      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href={`/portal/tickets?tab=${listTab}`}>Tickets</Link>
        <span className="breadcrumb-sep">›</span>
        <span>{ticket.display_number as string}</span>
      </nav>

      <div className="portal-ticket-header">
        <div>
          <div className="portal-ticket-id-row">
            <span className="portal-ticket-id">{ticket.display_number as string}</span>
            <StatusPill
              status={ticket.status.name}
              forRequester
              breached={!!ticket.sla_breached}
            />
          </div>
          <h1 className="portal-ticket-subject">{ticket.subject as string}</h1>
          <p className="portal-ticket-meta">
            {ticket.support_team as string} · updated {formatDateTime(ticket.updated_at as string)}
          </p>
        </div>
        <a className="btn portal-submit btn-sm" href="#portal-reply">
          {canReopen ? 'Reply & reopen' : 'Reply'}
        </a>
      </div>

      <div className="workbench portal-ticket-layout">
        <div className="workbench-main">
          <div className="card card-elevated">
            <h2 className="card-title">Conversation</h2>
            <div className="thread portal-thread">
              {publicMessages.map((m) => {
                const mine = m.author_id === user.id;
                return (
                  <div
                    key={m.id as number}
                    className={`msg public${mine ? ' msg-mine' : ' msg-theirs'}`}
                  >
                    <div className="meta">
                      <span className="msg-author">
                        {mine ? 'You' : ((m.author_name as string) ?? 'Support')}
                      </span>
                      <span>· {formatDateTime(m.created_at as string)}</span>
                    </div>
                    <MessageBody body={m.body as string} bodyHtml={m.body_html as string | null} />
                  </div>
                );
              })}
            </div>

            <div className="portal-reply" id="portal-reply">
              <h3 className="card-title">
                {canReopen ? 'Reply to reopen' : 'Your reply'}
              </h3>
              {canReopen ? (
                <p className="field-hint">
                  This ticket is marked {ticket.status.name}. Sending a reply reopens it for the
                  support team.
                </p>
              ) : (
                <p className="field-hint">Your message is emailed to the assigned agent or team mailbox.</p>
              )}
              <form action={reply}>
                <input type="hidden" name="ticket_id" value={ticket.id as number} />
                <label htmlFor="body" className="sr-only">
                  Message
                </label>
                <textarea
                  id="body"
                  name="body"
                  required
                  rows={4}
                  placeholder={
                    canReopen
                      ? 'Send a reply to reopen this ticket…'
                      : 'Add more details or answer agent questions…'
                  }
                />
                <div className="composer-actions">
                  <SubmitButton className="btn portal-submit" pendingLabel="Sending…">
                    {canReopen ? 'Reply & reopen' : 'Send reply'}
                  </SubmitButton>
                </div>
              </form>
            </div>
          </div>
        </div>
        <aside className="workbench-side">
          <div className="card card-elevated">
            <h3 className="card-title">Details</h3>
            <dl className="portal-detail-list">
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusPill
                    status={ticket.status.name}
                    forRequester
                    breached={!!ticket.sla_breached}
                  />
                </dd>
              </div>
              <div>
                <dt>Team</dt>
                <dd>{ticket.group_name as string}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd className="capitalize">{ticket.source as string}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDateTime(ticket.created_at as string)}</dd>
              </div>
              {ticket.cc ? (
                <div>
                  <dt>CC</dt>
                  <dd>{ticket.cc as string}</dd>
                </div>
              ) : null}
              {ticket.other_remarks ? (
                <div>
                  <dt>Remarks</dt>
                  <dd>{ticket.other_remarks as string}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          {attachments.length > 0 ? (
            <div className="card card-elevated">
              <h3 className="card-title">Attachments</h3>
              <div className="attachment-list">
                {attachments.map((a) => (
                  <AttachmentCard
                    key={a.id}
                    id={a.id}
                    filename={a.filename}
                    sizeBytes={a.size_bytes}
                    storageKey={a.storage_key}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <div className="card portal-aside">
            <h3 className="card-title">What happens next</h3>
            <p className="field-hint" style={{ margin: 0 }}>
              Support responds according to your team’s service levels. You’ll see updates in this
              thread and by email.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
