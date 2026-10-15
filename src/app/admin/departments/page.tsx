import { FlashBanner } from '@/components/FlashBanner';
import { PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { createDepartmentAction } from '@/lib/directory-actions';
import { requireStaffRoleOrRedirect } from '@/lib/auth';
import { listDepartments } from '@/lib/platform';

const ERROR_COPY: Record<string, string> = {
  NAME_EXISTS: 'A department with that name already exists.',
  NAME_REQUIRED: 'Department name is required.',
  FAILED: 'Could not create department. Try again.',
};

export default async function AdminDepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  await requireStaffRoleOrRedirect(['admin', 'supervisor']);
  const sp = await searchParams;
  const departments = listDepartments();

  return (
    <div className="admin-directory">
      <PageHeader
        title="Departments"
        description="Org units used on user profiles and as an approver directory."
        backHref="/admin"
        backLabel="Admin"
      />
      {sp.created === '1' ? <FlashBanner variant="success">Department created.</FlashBanner> : null}
      {sp.error ? (
        <FlashBanner variant="warn">{ERROR_COPY[sp.error] ?? ERROR_COPY.FAILED}</FlashBanner>
      ) : null}

      <div className="admin-directory-layout">
        <section className="card card-elevated admin-create-card">
          <h2 className="card-title">Add department</h2>
          <form action={createDepartmentAction} className="stacked-form">
            <label htmlFor="dept_name">Department name *</label>
            <input id="dept_name" name="name" required placeholder="Engineering" />
            <label htmlFor="dept_approver">Approver email</label>
            <input
              id="dept_approver"
              name="approver_email"
              type="email"
              placeholder="lead@moglix.com"
            />
            <SubmitButton pendingLabel="Creating…">Create department</SubmitButton>
          </form>
        </section>

        <section className="card card-elevated" style={{ padding: 0 }}>
          <div className="table-wrap table-wrap-flush">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Approver email</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id as number}>
                    <td>{d.name as string}</td>
                    <td>{(d.approver_email as string) ?? '—'}</td>
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
