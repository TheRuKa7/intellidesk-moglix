import { redirect } from 'next/navigation';
import { FlashBanner } from '@/components/FlashBanner';
import { PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { requireStaffRoleOrRedirect } from '@/lib/auth';
import { listNotificationEvents, type NotificationEvent } from '@/lib/notifications';
import { isNotificationEventEnabled, setNotificationEventEnabled } from '@/lib/platform';

const EVENT_LABELS: Record<NotificationEvent, string> = {
  ticket_created: 'Ticket created (requester)',
  team_notify: 'New ticket (team)',
  agent_reply: 'Agent public reply',
  requester_reply: 'Requester reply',
  assigned: 'Ticket assigned (agent)',
  sla_breach: 'SLA breach',
  resolved: 'Ticket resolved',
  closed: 'Ticket closed',
};

const EVENTS = listNotificationEvents().map((key) => ({
  key,
  label: EVENT_LABELS[key],
}));

async function saveNotificationToggles(formData: FormData) {
  'use server';
  const user = await requireStaffRoleOrRedirect(['admin']);
  for (const ev of EVENTS) {
    const on = formData.get(ev.key) === 'on';
    setNotificationEventEnabled(ev.key, on, user.id);
  }
  redirect('/admin/notifications?saved=1');
}

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireStaffRoleOrRedirect(['admin']);
  const sp = await searchParams;

  return (
    <div>
      <PageHeader
        title="Email notifications"
        description="Toggle which lifecycle events queue outbound mail. Unchecked events are suppressed (no outbox row). Templates stay Handlebars in code."
        backHref="/admin"
        backLabel="Admin"
      />
      {sp.saved === '1' ? <FlashBanner variant="success">Notification preferences saved.</FlashBanner> : null}
      <div className="card card-elevated" style={{ maxWidth: 560 }}>
        <p className="field-hint" style={{ marginBottom: 12 }}>
          Defaults to on when unset. Controls which lifecycle events send email in this workspace.
        </p>
        <form action={saveNotificationToggles} className="stacked-form">
          {EVENTS.map((ev) => (
            <label key={ev.key} className="fs-dueby-option" style={{ display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                name={ev.key}
                value="on"
                defaultChecked={isNotificationEventEnabled(ev.key)}
              />
              <span>
                {ev.label}
                <span className="field-hint" style={{ display: 'block' }}>
                  notify.{ev.key}
                </span>
              </span>
            </label>
          ))}
          <div className="page-actions" style={{ marginTop: 16 }}>
            <SubmitButton pendingLabel="Saving…">Save toggles</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
