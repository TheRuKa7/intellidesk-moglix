import { FlashBanner } from '@/components/FlashBanner';
import { PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { createRoleAction } from '@/lib/directory-actions';
import { requireStaffRoleOrRedirect } from '@/lib/auth';
import { listRolesWithPrivileges } from '@/lib/platform';
import { PRIVILEGES } from '@/lib/privileges';

const ERROR_COPY: Record<string, string> = {
  NAME_EXISTS: 'A role with that name already exists.',
  NAME_REQUIRED: 'Role name is required.',
  FAILED: 'Could not create role. Try again.',
};

export default async function AdminPrivilegesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  await requireStaffRoleOrRedirect(['admin']);
  const sp = await searchParams;
  const roles = listRolesWithPrivileges();

  return (
    <div className="admin-directory">
      <PageHeader
        title="Roles & permissions"
        description={`${roles.length} roles · ${PRIVILEGES.length} privileges. Custom roles inherit a level and privilege set.`}
        backHref="/admin"
        backLabel="Admin"
      />
      {sp.created === '1' ? <FlashBanner variant="success">Role created.</FlashBanner> : null}
      {sp.error ? (
        <FlashBanner variant="warn">{ERROR_COPY[sp.error] ?? ERROR_COPY.FAILED}</FlashBanner>
      ) : null}

      <div className="admin-directory-layout admin-directory-layout-wide">
        <section className="card card-elevated admin-create-card">
          <h2 className="card-title">Add role</h2>
          <form action={createRoleAction} className="stacked-form">
            <label htmlFor="role_name">Role name *</label>
            <input id="role_name" name="name" required placeholder="L1 Agent — Night" />
            <label htmlFor="role_level">Access level *</label>
            <select id="role_level" name="level" defaultValue="agent">
              <option value="requester">Requester</option>
              <option value="agent">Agent</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
            <fieldset className="priv-fieldset">
              <legend>Privileges</legend>
              <div className="priv-grid">
                {PRIVILEGES.map((p) => (
                  <label key={p.key} className="priv-check">
                    <input type="checkbox" name="privilege" value={p.key} />
                    <span>
                      <strong>{p.key}</strong>
                      <span className="field-hint">{p.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <SubmitButton pendingLabel="Creating…">Create role</SubmitButton>
          </form>
        </section>

        <div className="admin-roles-stack">
          <section className="card card-elevated">
            <h3 className="card-title">Privilege catalogue</h3>
            <ul className="activity-list">
              {PRIVILEGES.map((p) => (
                <li key={p.key} className="activity-item">
                  <strong>{p.key}</strong>
                  <div className="activity-meta">{p.description}</div>
                </li>
              ))}
            </ul>
          </section>
          <section className="card card-elevated">
            <h3 className="card-title">Role model ({roles.length})</h3>
            <div className="table-wrap">
              <table className="data-table data-table-dense">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Level</th>
                    <th>Privileges</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td className="capitalize">{r.level}</td>
                      <td className="tabular-nums">{r.privileges.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
