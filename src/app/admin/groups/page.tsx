import { FlashBanner } from '@/components/FlashBanner';
import { PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { createGroupAction } from '@/lib/directory-actions';
import { requireStaffRoleOrRedirect } from '@/lib/auth';
import { listGroups, listMailboxes } from '@/lib/platform';

const ERROR_COPY: Record<string, string> = {
  NAME_EXISTS: 'A group with that name already exists.',
  NAME_REQUIRED: 'Group name is required.',
  FAILED: 'Could not create group. Try again.',
};

export default async function AdminGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  await requireStaffRoleOrRedirect(['admin', 'supervisor']);
  const sp = await searchParams;
  const groups = listGroups();
  const mailboxes = listMailboxes();

  return (
    <div className="admin-directory">
      <PageHeader
        title="Agent groups"
        description="Queues that own tickets — mailbox and auto-assignment settings."
        backHref="/admin"
        backLabel="Admin"
      />
      {sp.created === '1' ? <FlashBanner variant="success">Group created.</FlashBanner> : null}
      {sp.error ? (
        <FlashBanner variant="warn">{ERROR_COPY[sp.error] ?? ERROR_COPY.FAILED}</FlashBanner>
      ) : null}

      <div className="admin-directory-layout">
        <section className="card card-elevated admin-create-card">
          <h2 className="card-title">Add group</h2>
          <form action={createGroupAction} className="stacked-form">
            <label htmlFor="group_name">Group name *</label>
            <input id="group_name" name="name" required placeholder="Tech Support Team" />
            <label htmlFor="group_mailbox">Mailbox</label>
            <select id="group_mailbox" name="mailbox" defaultValue="">
              <option value="">None</option>
              {mailboxes.map((m) => (
                <option key={m.id as number} value={m.address as string}>
                  {(m.name as string)} · {(m.address as string)}
                </option>
              ))}
            </select>
            <p className="field-hint">Pick from Admin → Mailboxes, or leave blank.</p>
            <label className="fs-dueby-option" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="checkbox" name="auto_assign" value="1" defaultChecked />
              Automatic ticket assignment
            </label>
            <SubmitButton pendingLabel="Creating…">Create group</SubmitButton>
          </form>
        </section>

        <section className="card card-elevated" style={{ padding: 0 }}>
          <div className="table-wrap table-wrap-flush">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Mailbox</th>
                  <th>Auto-assign</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id as number}>
                    <td>{g.name as string}</td>
                    <td>{(g.mailbox as string) ?? '—'}</td>
                    <td>{g.auto_assign ? 'On' : 'Off'}</td>
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
