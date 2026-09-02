import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Banner, PageHeader } from '@/components/ui';
import { requireStaffOrRedirect } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { PILOT_MAILBOX } from '@/lib/constants';
import { getLatestTicketDisplayNumber, getOutbox, processInboundEmail } from '@/lib/tickets';

async function sendInbound(formData: FormData) {
  'use server';
  await requireStaffOrRedirect();
  const ticket = processInboundEmail({
    from: String(formData.get('from')),
    fromName: String(formData.get('from_name') || '') || undefined,
    to: String(formData.get('to')),
    subject: String(formData.get('subject')),
    body: String(formData.get('body')),
  });
  if (ticket) {
    redirect(`/agent/tickets/${ticket.id}?saved=1`);
  }
  redirect('/mail');
}

export default async function MailSimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  await requireStaffOrRedirect();
  const sp = await searchParams;
  const outbox = getOutbox();
  const isThread = sp.mode === 'thread';
  const threadTicket = getLatestTicketDisplayNumber() ?? 'INC-2176596';

  return (
    <div>
      <PageHeader
        title="Mail simulator"
        description="Test inbound email and inspect outbound notifications. Replies with [INC-…] in the subject thread onto the existing ticket."
        backHref="/agent"
        backLabel="Queue"
      />
      <Banner variant="info">
        Pilot mailbox: <strong>{PILOT_MAILBOX}</strong>. In production, IMAP ingests within seconds and DKIM-signs outbound mail.
      </Banner>
      <div className="grid grid-2">
        <div className="card">
          <div className="page-actions" style={{ marginBottom: 16 }}>
            <Link
              className={`btn btn-sm ${!isThread ? '' : 'btn-ghost'}`}
              href="/mail"
            >
              New email
            </Link>
            <Link
              className={`btn btn-sm ${isThread ? '' : 'btn-ghost'}`}
              href="/mail?mode=thread"
            >
              Thread reply
            </Link>
          </div>
          <form action={sendInbound}>
            <label htmlFor="from">From email</label>
            <input id="from" name="from" type="email" defaultValue="employee@moglix.com" required />
            <label htmlFor="from_name">From name</label>
            <input id="from_name" name="from_name" defaultValue="Rahul Employee" />
            <label htmlFor="to">To</label>
            <input id="to" name="to" defaultValue={PILOT_MAILBOX} required />
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              name="subject"
              defaultValue={isThread ? `Re: [${threadTicket}] Follow up on VPN` : 'VPN not working from home'}
              placeholder="Include [INC-…] to thread"
              required
            />
            <label htmlFor="body">Body</label>
            <textarea id="body" name="body" required defaultValue={isThread ? 'Still unable to connect after reboot.' : 'I cannot access internal tools via VPN.'} />
            <button className="btn" type="submit">
              Process inbound email
            </button>
          </form>
        </div>
        <div className="card">
          <h3 className="card-title">Outbox</h3>
          <p className="field-hint" style={{ marginTop: 0 }}>
            Lifecycle emails queue here instead of SMTP in the prototype.
          </p>
          <div className="thread">
            {outbox.length === 0 ? (
              <p>No outbound mail yet.</p>
            ) : (
              (outbox as Record<string, unknown>[]).map((m) => (
                <div key={m.id as number} className="msg public">
                  <div className="meta">
                    <span className="pill">{m.event as string}</span> → {m.to_addr as string} ·{' '}
                    {formatDateTime(m.sent_at as string)}
                  </div>
                  <strong>{m.subject as string}</strong>
                  <pre className="body" style={{ margin: '8px 0' }}>
                    {m.body as string}
                  </pre>
                  <Link href={`/agent/tickets/${m.ticket_id}`}>View ticket</Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
