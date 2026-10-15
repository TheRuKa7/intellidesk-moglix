import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState, PageHeader } from '@/components/ui';
import { FlashBanner } from '@/components/FlashBanner';
import { SubmitButton } from '@/components/SubmitButton';
import { requireStaffRoleOrRedirect } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { listSpamQuarantine } from '@/lib/platform';
import { releaseSpamQuarantine } from '@/lib/tickets';

async function releaseAction(formData: FormData) {
  'use server';
  const user = await requireStaffRoleOrRedirect(['admin']);
  const id = Number(formData.get('id'));
  const ticket = releaseSpamQuarantine(id, user.id);
  if (ticket) {
    redirect(`/admin/spam?released=${encodeURIComponent(String(ticket.display_number))}&tid=${ticket.id}`);
  }
  redirect('/admin/spam?error=1');
}

export default async function AdminSpamPage({
  searchParams,
}: {
  searchParams: Promise<{ released?: string; tid?: string; error?: string }>;
}) {
  await requireStaffRoleOrRedirect(['admin']);
  const sp = await searchParams;
  const rows = listSpamQuarantine();
  const releasedTid = sp.tid ? Number(sp.tid) : NaN;

  return (
    <div>
      <PageHeader
        title="Spam quarantine"
        description="Inbound messages rejected by sender-domain policy. Release creates a Tech Support ticket for review."
        backHref="/admin"
        backLabel="Admin"
      />
      {sp.released ? (
        <FlashBanner variant="success">
          Released as{' '}
          {Number.isFinite(releasedTid) ? (
            <Link href={`/agent/tickets/${releasedTid}`}>
              <strong>{sp.released}</strong>
            </Link>
          ) : (
            <strong>{sp.released}</strong>
          )}
          . Quarantine row removed.
        </FlashBanner>
      ) : null}
      {sp.error ? <FlashBanner variant="warn">Could not release that item.</FlashBanner> : null}
      <div className="card card-elevated" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <EmptyState
            title="Quarantine empty"
            description="Non-allowlisted domains are blocked on inbound parse."
          />
        ) : (
          <div className="table-wrap table-wrap-flush">
            <table className="data-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>Subject</th>
                  <th>Reason</th>
                  <th>When</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id as number}>
                    <td>{r.from_addr as string}</td>
                    <td>{r.subject as string}</td>
                    <td>{r.reason as string}</td>
                    <td className="tabular-nums">{formatDateTime(r.created_at as string)}</td>
                    <td>
                      <form action={releaseAction}>
                        <input type="hidden" name="id" value={r.id as number} />
                        <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">
                          Release
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
