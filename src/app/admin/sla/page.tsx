import { DemoOnlyBanner } from '@/components/DemoOnlyBanner';
import { PageHeader } from '@/components/ui';
import { requireStaffRoleOrRedirect } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listHolidays } from '@/lib/holidays';

export default async function AdminSlaPage() {
  await requireStaffRoleOrRedirect(['admin']);
  const policies = getDb()
    .prepare(
      'SELECT id, name, group_name, respond_hours, resolve_hours, active, sort_order FROM sla_policies ORDER BY sort_order',
    )
    .all() as Record<string, unknown>[];
  const holidays = listHolidays();

  return (
    <div>
      <PageHeader
        title="SLA and calendars"
        description="Pilot policies applied in order. Production targets 21 policies + 6 calendars."
        backHref="/admin"
        backLabel="Admin"
      />
      <DemoOnlyBanner noun="SLA policy set" />
      <div className="grid grid-2">
        <div className="card card-elevated">
          <h3 className="card-title">SLA policies</h3>
          <div className="table-wrap">
            <table className="data-table data-table-dense">
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Group</th>
                  <th>Respond</th>
                  <th>Resolve</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id as number}>
                    <td>{p.name as string}</td>
                    <td>{(p.group_name as string) ?? 'Default'}</td>
                    <td>{p.respond_hours as number}h</td>
                    <td>{p.resolve_hours as number}h</td>
                    <td>{p.active ? 'On' : 'Off'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card card-elevated">
          <h3 className="card-title">Holidays (IST)</h3>
          <ul className="activity-list">
            {holidays.map((h) => (
              <li key={h.date} className="activity-item">
                <strong>{h.date}</strong>
                <div className="activity-meta">{h.name}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
