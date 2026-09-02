import Link from 'next/link';
import { PageHeader, StatCard } from '@/components/ui';
import { getSessionUser } from '@/lib/auth';
import { getSupervisorReport, runAutoCloseJob } from '@/lib/tickets';

function toCsv(rows: Record<string, unknown>[], headers: string[]) {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

export default async function SupervisorPage() {
  const user = await getSessionUser();
  runAutoCloseJob();
  const report = getSupervisorReport(
    user?.role === 'admin' ? undefined : { groupName: user?.group_name ?? null },
  );

  const teamCsv = toCsv(report.byTeam as Record<string, unknown>[], ['group_name', 'count']);
  const statusCsv = toCsv(report.byStatus as Record<string, unknown>[], ['status', 'count']);
  const agentCsv = toCsv(report.byAgent as Record<string, unknown>[], ['agent', 'count']);

  return (
    <div>
      <PageHeader
        title="Supervisor report"
        description="Volume, SLA health, and team breakdown for your scope. Export any table to CSV."
        actions={
          <Link className="btn btn-ghost btn-sm" href="/agent">
            Agent queue
          </Link>
        }
      />
      <div className="grid-stats" style={{ marginBottom: 24 }}>
        <StatCard label="Created today" value={report.createdToday} />
        <StatCard label="Created (7 days)" value={report.createdWeek} />
        <StatCard label="Created (month)" value={report.createdMonth} />
        <StatCard label="Open now" value={report.open} />
        <StatCard label="Overdue" value={report.overdue} hint="Response or resolution past deadline" />
        <StatCard label="SLA breached" value={report.breached} />
        <StatCard label="SLA met (closed)" value={report.slaMet} />
      </div>
      <div className="grid grid-3">
        <div className="card">
          <h3 className="card-title">By group</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {(report.byTeam as { group_name: string; count: number }[]).map((r) => (
                  <tr key={r.group_name}>
                    <td>{r.group_name}</td>
                    <td className="tabular-nums">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12 }}
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(teamCsv)}`}
            download="by-group.csv"
          >
            Export CSV
          </a>
        </div>
        <div className="card">
          <h3 className="card-title">By status</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {(report.byStatus as { status: string; count: number }[]).map((r) => (
                  <tr key={r.status}>
                    <td>{r.status}</td>
                    <td className="tabular-nums">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12 }}
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(statusCsv)}`}
            download="by-status.csv"
          >
            Export CSV
          </a>
        </div>
        <div className="card">
          <h3 className="card-title">By agent</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Tickets</th>
                </tr>
              </thead>
              <tbody>
                {(report.byAgent as { agent: string; count: number }[]).map((r) => (
                  <tr key={r.agent}>
                    <td>{r.agent}</td>
                    <td className="tabular-nums">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12 }}
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(agentCsv)}`}
            download="by-agent.csv"
          >
            Export CSV
          </a>
        </div>
      </div>
    </div>
  );
}
