import Link from 'next/link';

export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  actions,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {backHref ? (
          <Link href={backHref} className="back-link">
            ← {backLabel ?? 'Back'}
          </Link>
        ) : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-desc">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Banner({ variant, children }: { variant: 'success' | 'info' | 'warn'; children: React.ReactNode }) {
  return <div className={`banner banner-${variant}`}>{children}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card-value tabular-nums">{value}</div>
      <div className="stat-card-label">{label}</div>
      {hint ? <div className="stat-card-hint">{hint}</div> : null}
    </div>
  );
}

export function StatusPill({
  status,
  breached,
  forRequester,
}: {
  status: string;
  breached?: boolean;
  forRequester?: boolean;
}) {
  const label = forRequester ? status.toUpperCase() : status;
  const category = statusCategory(status);
  return (
    <span className="pill-group">
      <span className={`pill pill-${category}`}>{label}</span>
      {breached ? <span className="pill pill-breach">SLA breached</span> : null}
    </span>
  );
}

function statusCategory(status: string): string {
  if (['Resolved', 'Interim Resolve', 'Closed'].includes(status)) return 'done';
  if (status === 'Pending' || status.includes('Approval')) return 'waiting';
  if (status === 'Open' || status === 'Re-Open') return 'open';
  return 'neutral';
}

export function SlaMeter({
  respondBy,
  resolveBy,
  firstResponseAt,
  resolvedAt,
  slaClock,
  breached,
}: {
  respondBy: string | null;
  resolveBy: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  slaClock: string;
  breached?: boolean;
}) {
  const paused = slaClock === 'pause';
  const stopped = slaClock === 'stop';
  return (
    <div className="sla-meter">
      <div className="sla-row">
        <span className="sla-label">First response</span>
        <span className={`sla-value ${!firstResponseAt && respondBy && Date.now() > new Date(respondBy).getTime() ? 'overdue' : ''}`}>
          {firstResponseAt ? 'Met' : paused ? 'Paused' : respondBy ? new Date(respondBy).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
        </span>
      </div>
      <div className="sla-row">
        <span className="sla-label">Resolution</span>
        <span className={`sla-value ${!resolvedAt && resolveBy && !paused && !stopped && Date.now() > new Date(resolveBy).getTime() ? 'overdue' : ''}`}>
          {resolvedAt ? 'Met' : paused ? 'Paused' : stopped ? 'Stopped' : resolveBy ? new Date(resolveBy).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
        </span>
      </div>
      {breached ? <p className="sla-breach-note">Breach recorded on this ticket.</p> : null}
    </div>
  );
}
