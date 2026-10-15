import Link from 'next/link';
import { FlashBanner } from '@/components/FlashBanner';
import { EmptyState, PageHeader, UserAvatar } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { createAgentAction, toggleUserActiveAction } from '@/lib/directory-actions';
import { requireStaffRoleOrRedirect } from '@/lib/auth';
import { listAgents, listDepartments, listGroups } from '@/lib/platform';

const ERROR_COPY: Record<string, string> = {
  EMAIL_EXISTS: 'That email is already in the directory.',
  INVALID_EMAIL: 'Enter a valid work email address.',
  NAME_REQUIRED: 'Name is required.',
  FAILED: 'Could not create agent. Try again.',
};

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string; error?: string }>;
}) {
  await requireStaffRoleOrRedirect(['admin', 'supervisor']);
  const sp = await searchParams;
  const agents = listAgents();
  const groups = listGroups();
  const departments = listDepartments();

  return (
    <div className="admin-directory">
      <PageHeader
        title="Agents"
        description="Staff who work tickets — assign a role, group, and department."
        backHref="/admin"
        backLabel="Admin"
      />
      {sp.created === '1' ? <FlashBanner variant="success">Agent created.</FlashBanner> : null}
      {sp.updated === '1' ? <FlashBanner variant="success">Agent status updated.</FlashBanner> : null}
      {sp.error ? (
        <FlashBanner variant="warn">{ERROR_COPY[sp.error] ?? ERROR_COPY.FAILED}</FlashBanner>
      ) : null}

      <div className="admin-directory-layout">
        <section className="card card-elevated admin-create-card">
          <h2 className="card-title">Add agent</h2>
          <p className="field-hint" style={{ marginTop: 0 }}>
            New agents can sign in immediately with their workspace email.
          </p>
          <form action={createAgentAction} className="stacked-form">
            <label htmlFor="agent_name">Full name *</label>
            <input id="agent_name" name="name" required placeholder="Priya Sharma" />
            <label htmlFor="agent_email">Work email *</label>
            <input
              id="agent_email"
              name="email"
              type="email"
              required
              placeholder="priya.sharma@moglix.com"
            />
            <label htmlFor="agent_role">Role *</label>
            <select id="agent_role" name="role" defaultValue="agent">
              <option value="agent">Agent</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
            <label htmlFor="agent_group">Group</label>
            <select id="agent_group" name="group_name" defaultValue="Tech Support Team">
              <option value="">Unassigned</option>
              {groups.map((g) => (
                <option key={g.id as number} value={g.name as string}>
                  {g.name as string}
                </option>
              ))}
            </select>
            <label htmlFor="agent_dept">Department</label>
            <select
              id="agent_dept"
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
            <SubmitButton pendingLabel="Creating…">Create agent</SubmitButton>
          </form>
        </section>

        <section className="card card-elevated" style={{ padding: 0 }}>
          {agents.length === 0 ? (
            <EmptyState
              title="No agents yet"
              description="Create the first agent to staff the queue."
            />
          ) : (
            <div className="table-wrap table-wrap-flush">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Group</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a) => (
                    <tr key={a.id as number}>
                      <td>
                        <span className="requester-cell">
                          <UserAvatar name={a.name as string} />
                          {a.name as string}
                        </span>
                      </td>
                      <td>{a.email as string}</td>
                      <td className="capitalize">{a.role as string}</td>
                      <td>{(a.group_name as string) ?? '—'}</td>
                      <td>{(a.department as string) ?? '—'}</td>
                      <td>
                        <span className={`status-dot ${a.active ? 'on' : 'off'}`}>
                          {a.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <form action={toggleUserActiveAction}>
                          <input type="hidden" name="user_id" value={a.id as number} />
                          <input type="hidden" name="active" value={a.active ? '0' : '1'} />
                          <input type="hidden" name="return_to" value="/admin/agents" />
                          <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">
                            {a.active ? 'Deactivate' : 'Activate'}
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
      <p className="field-hint" style={{ marginTop: 12 }}>
        API: <Link href="/api/v1/agents">GET /api/v1/agents</Link>
      </p>
    </div>
  );
}
