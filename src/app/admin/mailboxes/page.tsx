import { FlashBanner } from '@/components/FlashBanner';
import { PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { createMailboxAction } from '@/lib/directory-actions';
import { requireStaffRoleOrRedirect } from '@/lib/auth';
import { listGroups, listMailboxes } from '@/lib/platform';

const ERROR_COPY: Record<string, string> = {
  EMAIL_EXISTS: 'That mailbox address already exists.',
  INVALID_EMAIL: 'Enter a valid mailbox address.',
  NAME_REQUIRED: 'Mailbox name is required.',
  FAILED: 'Could not create mailbox. Try again.',
};

export default async function AdminMailboxesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  await requireStaffRoleOrRedirect(['admin']);
  const sp = await searchParams;
  const mailboxes = listMailboxes();
  const groups = listGroups();

  return (
    <div className="admin-directory">
      <PageHeader
        title="Mailboxes"
        description="Inbound addresses mapped to agent groups for routing."
        backHref="/admin"
        backLabel="Admin"
      />
      {sp.created === '1' ? <FlashBanner variant="success">Mailbox created.</FlashBanner> : null}
      {sp.error ? (
        <FlashBanner variant="warn">{ERROR_COPY[sp.error] ?? ERROR_COPY.FAILED}</FlashBanner>
      ) : null}

      <div className="admin-directory-layout">
        <section className="card card-elevated admin-create-card">
          <h2 className="card-title">Add mailbox</h2>
          <form action={createMailboxAction} className="stacked-form">
            <label htmlFor="mb_name">Display name *</label>
            <input id="mb_name" name="name" required placeholder="Tech Support" />
            <label htmlFor="mb_address">Address *</label>
            <input
              id="mb_address"
              name="address"
              type="email"
              required
              placeholder="techsupport@moglix.com"
            />
            <label htmlFor="mb_forward">Forward to</label>
            <input
              id="mb_forward"
              name="forward_to"
              type="email"
              placeholder="ops@moglilabs.local"
            />
            <label htmlFor="mb_group">Assign to group</label>
            <select id="mb_group" name="group_name" defaultValue="">
              <option value="">Unassigned</option>
              {groups.map((g) => (
                <option key={g.id as number} value={g.name as string}>
                  {g.name as string}
                </option>
              ))}
            </select>
            <label className="fs-dueby-option" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="checkbox" name="is_primary" value="1" />
              Set as primary mailbox
            </label>
            <SubmitButton pendingLabel="Creating…">Create mailbox</SubmitButton>
          </form>
        </section>

        <section className="card card-elevated" style={{ padding: 0 }}>
          <div className="table-wrap table-wrap-flush">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                  <th>Forward to</th>
                  <th>Assign to group</th>
                  <th>Primary</th>
                </tr>
              </thead>
              <tbody>
                {mailboxes.map((m) => (
                  <tr key={m.id as number}>
                    <td>{m.name as string}</td>
                    <td>{m.address as string}</td>
                    <td>{(m.forward_to as string) ?? '—'}</td>
                    <td>{(m.group_name as string) ?? '—'}</td>
                    <td>{m.is_primary ? '★' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
