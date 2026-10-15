import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Banner, PageHeader } from '@/components/ui';
import { requireStaffOrRedirect } from '@/lib/auth';
import { parseMimeSource } from '@/lib/email-parser';
import { formatDateTime } from '@/lib/format';
import { PILOT_MAILBOX } from '@/lib/constants';
import { isAllowedSenderDomain } from '@/lib/platform';
import {
  getLatestTicketDisplayNumber,
  getOutbox,
  processInboundEmail,
  processInboundParsed,
} from '@/lib/tickets';

async function sendInbound(formData: FormData) {
  'use server';
  await requireStaffOrRedirect();
  const mimeFile = formData.get('eml_file') as File | null;
  const mimeRaw = String(formData.get('mime_raw') || '');
  const hasMime = (mimeFile && mimeFile.size > 0) || Boolean(mimeRaw.trim());

  if (hasMime) {
    let source: Buffer | null = null;
    if (mimeFile && mimeFile.size > 0) {
      source = Buffer.from(await mimeFile.arrayBuffer());
    } else {
      source = Buffer.from(mimeRaw, 'utf8');
    }
    const parsed = await parseMimeSource(source!);
    if (!parsed.from || !parsed.subject) {
      redirect('/mail?error=mime');
    }
    const ticket = processInboundParsed(parsed);
    if (ticket) redirect(`/agent/tickets/${ticket.id}?saved=1`);
    if (parsed.isAutoReply || parsed.isBounce) redirect('/mail?suppressed=auto');
    if (parsed.from && !isAllowedSenderDomain(parsed.from)) redirect('/mail?error=spam');
    redirect('/mail?error=failed');
  }

  const from = String(formData.get('from') || '').trim();
  const to = String(formData.get('to') || '').trim();
  const subject = String(formData.get('subject') || '').trim();
  const body = String(formData.get('body') || '').trim();
  if (!from || !to || !subject || !body) {
    redirect('/mail?error=fields');
  }

  const ticket = processInboundEmail({
    from,
    fromName: String(formData.get('from_name') || '') || undefined,
    to,
    subject,
    body,
  });
  if (ticket) redirect(`/agent/tickets/${ticket.id}?saved=1`);
  if (!isAllowedSenderDomain(from)) redirect('/mail?error=spam');
  redirect('/mail?suppressed=auto');
}

export default async function InboundTestPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; suppressed?: string }>;
}) {
  await requireStaffOrRedirect();
  const sp = await searchParams;
  const outbox = getOutbox();
  const isThread = sp.mode === 'thread';
  const threadTicket = getLatestTicketDisplayNumber() ?? 'INC-2176596';

  return (
    <div>
      <PageHeader
        title="Inbound email test"
        description="Simulate mailbox ingest for pilot QA. Agents create walk-up tickets from New ticket — this page feeds the same inbound pipeline via form or .eml."
        backHref="/admin"
        backLabel="Admin"
      />
      <Banner variant="info">
        Pilot mailbox: <strong>{PILOT_MAILBOX}</strong>. For phone/walk-up use{' '}
        <Link href="/agent/new">New ticket</Link>. Provide form fields <em>or</em> MIME/.eml.
      </Banner>
      {sp.error === 'mime' ? (
        <Banner variant="warn">Could not parse MIME — paste raw source or upload a valid .eml.</Banner>
      ) : null}
      {sp.error === 'fields' ? (
        <Banner variant="warn">
          Form mode needs From, To, Subject, and Body — or upload MIME/.eml instead.
        </Banner>
      ) : null}
      {sp.error === 'spam' ? (
        <Banner variant="warn">
          Sender domain is not allowed — message moved to spam quarantine. Release it from Admin →
          Spam.
        </Banner>
      ) : null}
      {sp.error === 'failed' ? (
        <Banner variant="warn">Inbound could not create or update a ticket. Check From/Subject and try again.</Banner>
      ) : null}
      {sp.suppressed === 'auto' ? (
        <Banner variant="warn">Auto-reply detected — no ticket created (loop suppression).</Banner>
      ) : null}
      <div className="grid grid-2">
        <div className="card card-elevated">
          <div className="page-actions" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
            <Link className={`btn btn-sm ${!isThread ? '' : 'btn-ghost'}`} href="/mail">
              New inbound
            </Link>
            <Link className={`btn btn-sm ${isThread ? '' : 'btn-ghost'}`} href="/mail?mode=thread">
              Thread reply
            </Link>
          </div>
          <form action={sendInbound} encType="multipart/form-data">
            <p className="field-hint" style={{ marginTop: 0 }}>
              Path A — form fields (leave blank if using MIME below)
            </p>
            <label htmlFor="from">From email</label>
            <input id="from" name="from" type="email" defaultValue="employee@moglix.com" />
            <label htmlFor="from_name">From name</label>
            <input id="from_name" name="from_name" defaultValue="Rahul Employee" />
            <label htmlFor="to">To</label>
            <input id="to" name="to" defaultValue={PILOT_MAILBOX} />
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              name="subject"
              defaultValue={
                isThread ? `Re: [${threadTicket}] Follow up on VPN` : 'VPN not working from home'
              }
              placeholder="Include [INC-…] to thread"
            />
            <label htmlFor="body">Body (plain)</label>
            <textarea
              id="body"
              name="body"
              defaultValue={
                isThread
                  ? 'Still unable to connect after reboot.'
                  : 'I cannot access internal tools via VPN.'
              }
            />
            <hr style={{ margin: '16px 0', border: 0, borderTop: '1px solid var(--border, #ddd)' }} />
            <p className="field-hint" style={{ marginTop: 0 }}>
              Path B — .eml / raw MIME (same ingest; overrides form when present)
            </p>
            <label htmlFor="eml_file">.eml file</label>
            <input id="eml_file" name="eml_file" type="file" accept=".eml,.txt,message/rfc822" />
            <label htmlFor="mime_raw">Or raw MIME</label>
            <textarea
              id="mime_raw"
              name="mime_raw"
              rows={6}
              placeholder="From: …&#10;Subject: …&#10;…"
            />
            <button className="btn" type="submit">
              Process inbound
            </button>
          </form>
        </div>
        <div className="card card-elevated">
          <h3 className="card-title">Outbound log</h3>
          <p className="field-hint" style={{ marginTop: 0 }}>
            Handlebars lifecycle mail (Nodemailer JSON transport).
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
