import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FlashBanner } from '@/components/FlashBanner';
import { PageHeader } from '@/components/ui';
import { StaffRequesterFields } from '@/components/StaffRequesterFields';
import { SubmitButton } from '@/components/SubmitButton';
import { TicketIntakeFields } from '@/components/TicketIntakeFields';
import { collectFormAttachments, maxAttachmentBytes } from '@/lib/attachment-limits';
import { requireStaffOrRedirect } from '@/lib/auth';
import { listRequesters } from '@/lib/platform';
import { createTicket, findOrCreateRequester, isPortalVisibleTeam } from '@/lib/tickets';

async function submitStaffIncident(formData: FormData) {
  'use server';
  const user = await requireStaffOrRedirect();
  const supportTeam = String(formData.get('support_team'));
  if (!isPortalVisibleTeam(supportTeam)) {
    redirect('/agent/new?error=team');
  }

  const subject = String(formData.get('subject') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!subject || !description) {
    redirect('/agent/new?error=fields');
  }

  let requesterId = Number(formData.get('requester_id') || 0);
  const requesterEmail = String(formData.get('requester_email') || '')
    .trim()
    .toLowerCase();
  if (!requesterId) {
    if (!requesterEmail || !requesterEmail.includes('@')) {
      redirect('/agent/new?error=requester');
    }
    requesterId = findOrCreateRequester(
      requesterEmail,
      String(formData.get('requester_name') || '').trim() || undefined,
    );
  }

  const sourceRaw = String(formData.get('source') || 'phone');
  const source = (['phone', 'portal', 'other'].includes(sourceRaw) ? sourceRaw : 'phone') as
    | 'phone'
    | 'portal'
    | 'other';

  let attachments: { filename: string; data: Buffer; contentType?: string }[] = [];
  try {
    attachments = await collectFormAttachments(formData);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('ATTACHMENT_TOO_LARGE:')) {
      redirect(`/agent/new?error=attach&max=${e.message.split(':')[1]}`);
    }
    throw e;
  }

  const ticket = createTicket({
    subject,
    description,
    supportTeam,
    requesterId,
    source,
    cc: String(formData.get('cc') || '') || undefined,
    otherRemarks: String(formData.get('other_remarks') || '') || undefined,
    attachments,
    actorId: user.id,
  });
  redirect(`/agent/tickets/${ticket?.id}?notice=created`);
}

export default async function StaffNewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; max?: string }>;
}) {
  await requireStaffOrRedirect();
  const sp = await searchParams;
  const requesters = listRequesters()
    .filter((r) => Number(r.active) === 1)
    .map((r) => ({
      id: r.id as number,
      name: r.name as string,
      email: r.email as string,
    }));
  const maxMb = Math.round(maxAttachmentBytes() / (1024 * 1024));

  return (
    <div>
      {sp.error === 'team' ? (
        <FlashBanner variant="warn">Please select a valid support team.</FlashBanner>
      ) : null}
      {sp.error === 'requester' ? (
        <FlashBanner variant="warn">Select a requester or enter a valid email.</FlashBanner>
      ) : null}
      {sp.error === 'fields' ? (
        <FlashBanner variant="warn">Subject and description are required.</FlashBanner>
      ) : null}
      {sp.error === 'attach' ? (
        <FlashBanner variant="warn">
          Attachment exceeds the {sp.max ?? maxMb} MB security limit.
        </FlashBanner>
      ) : null}
      <PageHeader
        title="New ticket"
        description="Same intake fields as the employee portal — for phone, walk-up, or chat requests."
        backHref="/agent"
        backLabel="Queue"
      />
      <div className="grid grid-2 portal-form-layout">
        <div className="card card-elevated">
          <form action={submitStaffIncident} encType="multipart/form-data" className="portal-form">
            <StaffRequesterFields requesters={requesters} />
            <TicketIntakeFields maxAttachmentMb={maxMb} />
            <div className="form-actions">
              <SubmitButton className="btn" pendingLabel="Creating…">
                Create ticket
              </SubmitButton>
              <Link className="btn btn-ghost" href="/agent">
                Cancel
              </Link>
            </div>
          </form>
        </div>
        <aside className="card portal-aside">
          <h3 className="card-title">Create on behalf of</h3>
          <p className="field-hint" style={{ marginTop: 0 }}>
            Same intake fields as the employee portal. Choose a requester from the directory, or enter
            an email to create or match them. Email-originated tickets arrive through configured
            mailboxes.
          </p>
        </aside>
      </div>
    </div>
  );
}
