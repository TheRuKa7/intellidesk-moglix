import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FlashBanner } from '@/components/FlashBanner';
import { PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { TicketIntakeFields } from '@/components/TicketIntakeFields';
import { collectFormAttachments, maxAttachmentBytes } from '@/lib/attachment-limits';
import { requireRequesterOrRedirect } from '@/lib/auth';
import { createTicket, isPortalVisibleTeam } from '@/lib/tickets';

async function submitIncident(formData: FormData) {
  'use server';
  const user = await requireRequesterOrRedirect();
  const supportTeam = String(formData.get('support_team'));
  if (!isPortalVisibleTeam(supportTeam)) {
    redirect('/portal/new?error=team');
  }
  const subject = String(formData.get('subject') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!subject || !description) {
    redirect('/portal/new?error=fields');
  }
  let attachments: { filename: string; data: Buffer; contentType?: string }[] = [];
  try {
    attachments = await collectFormAttachments(formData);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('ATTACHMENT_TOO_LARGE:')) {
      redirect(`/portal/new?error=attach&max=${e.message.split(':')[1]}`);
    }
    throw e;
  }
  const ticket = createTicket({
    subject,
    description,
    supportTeam,
    requesterId: user.id,
    source: 'portal',
    cc: String(formData.get('cc') || '') || undefined,
    otherRemarks: String(formData.get('other_remarks') || '') || undefined,
    attachments,
    actorId: user.id,
  });
  redirect(`/portal/tickets/${ticket?.id}?created=1`);
}

export default async function NewIncidentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; max?: string }>;
}) {
  const user = await requireRequesterOrRedirect();
  const sp = await searchParams;
  const maxMb = Math.round(maxAttachmentBytes() / (1024 * 1024));

  return (
    <div>
      {sp.error === 'team' ? (
        <FlashBanner variant="warn">Please select a valid support team from the list.</FlashBanner>
      ) : null}
      {sp.error === 'fields' ? (
        <FlashBanner variant="warn">Subject and description are required.</FlashBanner>
      ) : null}
      {sp.error === 'attach' ? (
        <FlashBanner variant="warn">
          Attachment exceeds the {sp.max ?? maxMb} MB security limit.
        </FlashBanner>
      ) : null}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/portal">Home</Link>
        <span className="breadcrumb-sep">›</span>
        <span>Submit a ticket</span>
      </nav>
      <PageHeader
        title="Submit a ticket"
        description="You'll receive a ticket number and confirmation email within 60 seconds."
      />
      <div className="grid grid-2 portal-form-layout">
        <div className="card card-elevated">
          <form action={submitIncident} encType="multipart/form-data" className="portal-form">
            <div className="form-row">
              <label>Requester *</label>
              <div>
                <input value={`${user.name} (${user.email})`} readOnly disabled />
                <Link className="inline-link" href="#cc">
                  Add cc
                </Link>
              </div>
            </div>
            <TicketIntakeFields maxAttachmentMb={maxMb} />
            <div className="form-actions">
              <SubmitButton className="btn portal-submit" pendingLabel="Submitting…">
                Submit
              </SubmitButton>
              <Link className="btn btn-ghost portal-cancel" href="/portal">
                Cancel
              </Link>
            </div>
          </form>
        </div>
        <aside className="card portal-aside">
          <h3 className="card-title">Tips for a faster resolution</h3>
          <ul className="portal-tips">
            <li>Pick the support team that owns the issue.</li>
            <li>Include impact and steps to reproduce in the description.</li>
            <li>CC a colleague if they need visibility on updates.</li>
            <li>Attach screenshots or error logs when available.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
