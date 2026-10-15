import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState, PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { requireStaffOrRedirect } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/platform';

async function markReadAction(formData: FormData) {
  'use server';
  const user = await requireStaffOrRedirect();
  markNotificationRead(Number(formData.get('id')), user.id);
  redirect('/notifications');
}

async function markAllReadAction() {
  'use server';
  const user = await requireStaffOrRedirect();
  markAllNotificationsRead(user.id);
  redirect('/notifications');
}

export default async function NotificationsPage() {
  const user = await requireStaffOrRedirect();
  const items = listNotifications(user.id);
  const unread = items.filter((n) => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="In-app alerts for ticket activity in your scope."
        backHref="/agent"
        backLabel="Queue"
        actions={
          unread > 0 ? (
            <form action={markAllReadAction}>
              <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="Updating…">
                Mark all read
              </SubmitButton>
            </form>
          ) : null
        }
      />
      <div className="card card-elevated">
        {items.length === 0 ? (
          <EmptyState title="You're caught up" description="New replies and assignments will appear here." />
        ) : (
          <ul className="activity-list">
            {items.map((n) => (
              <li key={n.id as number} className={`activity-item${!n.read ? ' activity-unread' : ''}`}>
                <div className="card-head" style={{ marginBottom: 4 }}>
                  <strong>{n.title as string}</strong>
                  {!n.read ? <span className="pill pill-open">Unread</span> : null}
                </div>
                <p className="field-hint" style={{ margin: 0 }}>
                  {n.body as string}
                </p>
                <div className="activity-meta">{formatDateTime(n.created_at as string)}</div>
                <div className="page-actions" style={{ marginTop: 8 }}>
                  {n.ticket_id ? (
                    <Link className="btn btn-ghost btn-sm" href={`/agent/tickets/${n.ticket_id}`}>
                      Open ticket
                    </Link>
                  ) : null}
                  {!n.read ? (
                    <form action={markReadAction}>
                      <input type="hidden" name="id" value={n.id as number} />
                      <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">
                        Mark read
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
