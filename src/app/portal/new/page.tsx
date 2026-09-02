import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { requireRequesterOrRedirect } from '@/lib/auth';
import { PORTAL_SUPPORT_TEAMS } from '@/lib/constants';
import { createTicket, isPortalVisibleTeam } from '@/lib/tickets';

async function submitIncident(formData: FormData) {
  'use server';
  const user = await requireRequesterOrRedirect();
  const supportTeam = String(formData.get('support_team'));
  if (!isPortalVisibleTeam(supportTeam)) {
    redirect('/portal/new?error=team');
  }
  const attachment = formData.get('attachment') as File | null;
  const attachmentNames: string[] = [];
  if (attachment && attachment.size > 0) {
    attachmentNames.push(attachment.name);
  }
  const ticket = createTicket({
    subject: String(formData.get('subject')),
    description: String(formData.get('description')),
    supportTeam: String(formData.get('support_team')),
    requesterId: user.id,
    source: 'portal',
    cc: String(formData.get('cc') || '') || undefined,
    otherRemarks: String(formData.get('other_remarks') || '') || undefined,
    attachmentNames,
    actorId: user.id,
  });
  redirect(`/portal/tickets/${ticket?.id}?created=1`);
}

export default async function NewIncidentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireRequesterOrRedirect();
  const sp = await searchParams;

  return (
    <div style={{ maxWidth: 720 }}>
      {sp.error === 'team' ? (
        <div className="banner banner-warn" style={{ marginBottom: 16 }}>
          Please select a valid support team from the list.
        </div>
      ) : null}
      <PageHeader
        title="Report an incident"
        description="Describe your issue. You'll receive a ticket number and confirmation email within 60 seconds."
        backHref="/portal"
        backLabel="Portal home"
      />
      <div className="card">
        <form action={submitIncident} encType="multipart/form-data">
          <div className="form-section">
            <h3 className="form-section-title">Who &amp; where</h3>
            <label>Requester</label>
            <input value={`${user.name} (${user.email})`} readOnly disabled />
            <label htmlFor="support_team">Support team</label>
            <select id="support_team" name="support_team" required defaultValue="Tech Support Team">
              {PORTAL_SUPPORT_TEAMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label htmlFor="cc">Add CC (optional)</label>
            <input id="cc" name="cc" type="email" placeholder="colleague@moglix.com" />
          </div>
          <div className="form-section">
            <h3 className="form-section-title">Issue details</h3>
            <label htmlFor="subject">Subject</label>
            <input id="subject" name="subject" required placeholder="Brief summary of the issue" />
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              required
              placeholder="What happened? Include steps to reproduce, error messages, and impact."
            />
            <label htmlFor="other_remarks">Other remarks (optional)</label>
            <textarea id="other_remarks" name="other_remarks" placeholder="Any extra context for the team" rows={3} />
          </div>
          <div className="form-section">
            <h3 className="form-section-title">Attachments</h3>
            <label htmlFor="attachment">Attach files (optional)</label>
            <input id="attachment" name="attachment" type="file" />
            <p className="field-hint">Screenshots or logs help agents resolve faster. Stored securely on the ticket.</p>
          </div>
          <button className="btn" type="submit">
            Submit incident
          </button>
        </form>
      </div>
    </div>
  );
}
