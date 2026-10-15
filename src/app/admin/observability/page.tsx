import { Banner, PageHeader } from '@/components/ui';
import { requireStaffRoleOrRedirect } from '@/lib/auth';
import { getMetrics, getRecentEvents } from '@/lib/observability';

export default async function AdminObservabilityPage() {
  await requireStaffRoleOrRedirect(['admin']);
  const metrics = getMetrics();
  const events = getRecentEvents(40);

  return (
    <div>
      <PageHeader
        title="Platform events"
        description="Workspace health metrics and recent system events. Production deployments export to OpenTelemetry / Sentry."
        backHref="/admin"
        backLabel="Admin"
      />
      <Banner variant="info">
        Ops view only — not day-to-day service-desk configuration. Use for monitoring and incident
        triage.
      </Banner>
      <div className="grid grid-2">
        <div className="card card-elevated">
          <h3 className="card-title">Metrics</h3>
          {metrics.length === 0 ? (
            <p className="field-hint">No metrics yet — process mail or hit the API.</p>
          ) : (
            <ul className="activity-list">
              {metrics.map((m) => (
                <li key={m.name} className="activity-item">
                  <strong>{m.name}</strong>
                  <div className="activity-meta">
                    {m.value} · updated {m.updated_at}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card card-elevated">
          <h3 className="card-title">Recent events</h3>
          <ul className="activity-list">
            {events.map((e) => (
              <li key={e.id as number} className="activity-item">
                <strong>
                  [{e.level as string}] {e.event as string}
                </strong>
                <div className="activity-meta">{e.created_at as string}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="field-hint" style={{ marginTop: 12 }}>
        Health API: GET /api/v1/health
      </p>
    </div>
  );
}
