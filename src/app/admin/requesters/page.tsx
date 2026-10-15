import { FlashBanner } from '@/components/FlashBanner';
import { EmptyState, PageHeader, UserAvatar } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { createRequesterAction, toggleUserActiveAction } from '@/lib/directory-actions';
import { requireStaffRoleOrRedirect } from '@/lib/auth';
import { listDepartments, listRequesters } from '@/lib/platform';

const ERROR_COPY: Record<string, string> = {
  EMAIL_EXISTS: 'That email is already in the directory.',
  INVALID_EMAIL: 'Enter a valid work email address.',
  NAME_REQUIRED: 'Name is required.',
  FAILED: 'Could not create requester. Try again.',
};

export default async function AdminRequestersPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string; error?: string }>;
}) {
  await requireStaffRoleOrRedirect(['admin', 'supervisor']);
  const sp = await searchParams;
  const requesters = listRequesters();
  const departments = listDepartments();

  return (
    <div className="admin-directory">
      <PageHeader
        title="Requesters"
        description="Employees who open portal tickets. Deactivated accounts cannot sign in."
        backHref="/admin"
        backLabel="Admin"
      />
      {sp.created === '1' ? <FlashBanner variant="success">Requester created.</FlashBanner> : null}
      {sp.updated === '1' ? (
        <FlashBanner variant="success">Requester status updated.</FlashBanner>
      ) : null}
      {sp.error ? (
        <FlashBanner variant="warn">{ERROR_COPY[sp.error] ?? ERROR_COPY.FAILED}</FlashBanner>
      ) : null}

      <div className="admin-directory-layout">
        <section className="card card-elevated admin-create-card">
          <h2 className="card-title">Add requester</h2>
          <form action={createRequesterAction} className="stacked-form">
            <label htmlFor="req_name">Full name *</label>
            <input id="req_name" name="name" required placeholder="Rahul Employee" />
            <label htmlFor="req_email">Work email *</label>
            <input
              id="req_email"
              name="email"
              type="email"
              required
              placeholder="rahul@moglix.com"
            />
            <label htmlFor="req_dept">Department</label>
            <select
              id="req_dept"
              name="department"
              defaultValue={departments[0] ? String(departments[0].name) : ''}
            >
              {departments.length === 0 ? (
                <option value="">No departments — create one first</option>
              ) : (
                departments.map((d) => (
                  <option key={d.id as number} value={d.name as string}>
                    {d.name as string}
                  </option>
                ))
              )}
            </select>
            <SubmitButton pendingLabel="Creating…">Create requester</SubmitButton>
          </form>
        </section>

        <section className="card card-elevated" style={{ padding: 0 }}>
          {requesters.length === 0 ? (
            <EmptyState
              title="No requesters"
              description="Create a requester or wait for portal / inbound email auto-create."
            />
          ) : (
            <div className="table-wrap table-wrap-flush">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Lifecycle</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {requesters.map((r) => (
                    <tr key={r.id as number}>
                      <td>
                        <span className="requester-cell">
                          <UserAvatar name={r.name as string} />
                          {r.name as string}
                        </span>
                      </td>
                      <td>{r.email as string}</td>
                      <td>{(r.department as string) ?? '—'}</td>
                      <td>
                        <span className={`status-dot ${r.active ? 'on' : 'off'}`}>
                          {r.active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td>
                        <form action={toggleUserActiveAction}>
                          <input type="hidden" name="user_id" value={r.id as number} />
                          <input type="hidden" name="active" value={r.active ? '0' : '1'} />
                          <input type="hidden" name="return_to" value="/admin/requesters" />
                          <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">
                            {r.active ? 'Deactivate' : 'Activate'}
                          </SubmitButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
