import { Banner, PageHeader } from '@/components/ui';
import { FlashBanner } from '@/components/FlashBanner';
import { SubmitButton } from '@/components/SubmitButton';
import { saveAccountSettingsAction } from '@/lib/admin-actions';
import { requireStaffRoleOrRedirect } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { listSettingsByPrefix } from '@/lib/platform';
import { ticketIdPrefix } from '@/lib/ticket-id';

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireStaffRoleOrRedirect(['admin']);
  const sp = await searchParams;
  const settings = listSettingsByPrefix('account.');
  const previewNow = formatDateTime(new Date().toISOString());
  const prefix = settings.ticket_id_prefix ?? ticketIdPrefix();

  return (
    <div>
      <PageHeader
        title="Account and localisation"
        description="Locale, timezone and ticket ID prefix drive timestamps and new ticket numbers across the desk."
        backHref="/admin"
        backLabel="Admin"
      />
      {sp.saved === '1' ? (
        <FlashBanner variant="success">Settings saved — timestamps and new ticket IDs use these values.</FlashBanner>
      ) : null}
      <Banner variant="info">
        Live datetime preview: <strong>{previewNow}</strong> · Next ticket IDs use prefix{' '}
        <strong>{prefix}</strong>
      </Banner>
      <div className="card card-elevated" style={{ maxWidth: 520 }}>
        <form action={saveAccountSettingsAction} className="stacked-form">
          <label htmlFor="locale">Locale</label>
          <select id="locale" name="locale" defaultValue={settings.locale ?? 'en-IN'}>
            <option value="en-IN">en-IN</option>
            <option value="en-US">en-US</option>
            <option value="en-GB">en-GB</option>
          </select>
          <label htmlFor="timezone">Timezone</label>
          <input id="timezone" name="timezone" defaultValue={settings.timezone ?? 'Asia/Kolkata'} />
          <p className="field-hint">Also used for Due today / Due-by queue buckets.</p>
          <label htmlFor="date_format">Date format (display hint)</label>
          <input id="date_format" name="date_format" defaultValue={settings.date_format ?? 'dd MMM yyyy'} />
          <label htmlFor="currency">Currency</label>
          <input id="currency" name="currency" defaultValue={settings.currency ?? 'INR'} />
          <label htmlFor="ticket_id_prefix">Ticket ID prefix</label>
          <input id="ticket_id_prefix" name="ticket_id_prefix" defaultValue={prefix} />
          <p className="field-hint">
            New tickets look like {prefix}2176600. Existing tickets keep their numbers.
          </p>
          <div className="page-actions" style={{ marginTop: 16 }}>
            <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
