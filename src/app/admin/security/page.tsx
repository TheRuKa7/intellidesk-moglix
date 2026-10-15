import { Banner, PageHeader } from '@/components/ui';
import { FlashBanner } from '@/components/FlashBanner';
import { SubmitButton } from '@/components/SubmitButton';
import { saveSecuritySettingsAction } from '@/lib/admin-actions';
import { requireStaffRoleOrRedirect } from '@/lib/auth';
import { listSettingsByPrefix } from '@/lib/platform';

export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireStaffRoleOrRedirect(['admin']);
  const sp = await searchParams;
  const settings = listSettingsByPrefix('security.');
  const maxMb = settings.max_attachment_mb ?? '25';

  return (
    <div>
      <PageHeader
        title="Security policy"
        description="Session lifetime, allowed sender domains, and attachment limits enforced in this workspace."
        backHref="/admin"
        backLabel="Admin"
      />
      {sp.saved === '1' ? (
        <FlashBanner variant="success">Security policy saved and applied to uploads.</FlashBanner>
      ) : null}
      <Banner variant="info">
        Attachment max ({maxMb} MB) and allowed email domains are enforced on portal, staff create,
        and inbound email. Public URL auth, ticket sharing, and force logout are saved for rollout
        and not enforced in this pilot build.
      </Banner>
      <div className="card card-elevated" style={{ maxWidth: 560 }}>
        <form action={saveSecuritySettingsAction} className="stacked-form">
          <label htmlFor="session_lifetime_hours">Session lifetime (hours)</label>
          <input
            id="session_lifetime_hours"
            name="session_lifetime_hours"
            type="number"
            min={1}
            defaultValue={settings.session_lifetime_hours ?? '12'}
          />
          <label htmlFor="public_url_auth">Public URL authentication</label>
          <select
            id="public_url_auth"
            name="public_url_auth"
            defaultValue={settings.public_url_auth ?? 'required'}
          >
            <option value="required">Required</option>
            <option value="optional">Optional</option>
          </select>
          <p className="field-hint">Saved for production rollout — not enforced in pilot.</p>
          <label htmlFor="ticket_sharing">Ticket sharing</label>
          <select
            id="ticket_sharing"
            name="ticket_sharing"
            defaultValue={settings.ticket_sharing ?? 'disabled'}
          >
            <option value="disabled">Disabled</option>
            <option value="agents_only">Agents only</option>
          </select>
          <p className="field-hint">Saved for production rollout — not enforced in pilot.</p>
          <label htmlFor="allowed_email_domains">Allowed email domains</label>
          <input
            id="allowed_email_domains"
            name="allowed_email_domains"
            defaultValue={settings.allowed_email_domains ?? 'moglix.com'}
          />
          <label htmlFor="max_attachment_mb">Max attachment (MB)</label>
          <input
            id="max_attachment_mb"
            name="max_attachment_mb"
            type="number"
            min={1}
            defaultValue={maxMb}
          />
          <p className="field-hint">Enforced on every upload path (create + inbound).</p>
          <label htmlFor="force_logout_enabled">Force logout enabled</label>
          <select
            id="force_logout_enabled"
            name="force_logout_enabled"
            defaultValue={settings.force_logout_enabled ?? 'true'}
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
          <p className="field-hint">Saved for production rollout — not enforced in pilot.</p>
          <div className="page-actions" style={{ marginTop: 16 }}>
            <SubmitButton pendingLabel="Saving…">Save policy</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
