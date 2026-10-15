import Link from 'next/link';
import { formatCountdown, formatFileSize, formatStatusLabel } from '@/lib/format';

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

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden>
        <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
          <rect x="4" y="8" width="32" height="24" rx="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 14h32M12 22h10M12 27h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  variant,
}: {
  label: string;
  value: string | number;
  hint?: string;
  variant?: 'default' | 'alert';
}) {
  return (
    <div className={`stat-card${variant === 'alert' ? ' stat-card-alert' : ''}`}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value tabular-nums">{value}</div>
      {hint ? <div className="stat-card-hint">{hint}</div> : null}
    </div>
  );
}

export function UserAvatar({ name, size }: { name: string; size?: 'sm' | 'lg' }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`
      : (parts[0]?.slice(0, 2) ?? '?');
  const hue =
    Array.from(name).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;
  return (
    <span
      className={`user-avatar${size === 'lg' ? ' user-avatar-lg' : ''}`}
      style={{ ['--avatar-hue' as string]: String(hue) }}
    >
      {initials.toUpperCase()}
    </span>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="breadcrumb-item">
          {i > 0 ? <span className="breadcrumb-sep">/</span> : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
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
  const label = formatStatusLabel(status, forRequester);
  const category = statusCategory(status);
  return (
    <span className="pill-group">
      <span className={`pill pill-${category}`}>{label}</span>
      {breached ? <span className="pill pill-breach">SLA breached</span> : null}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: string }) {
  const key = priority.toLowerCase();
  return <span className={`pill pill-priority pill-priority-${key}`}>{priority}</span>;
}

function statusCategory(status: string): string {
  if (['Resolved', 'Interim Resolve', 'Closed'].includes(status)) return 'done';
  if (
    status === 'Pending' ||
    status.includes('Approval') ||
    status.includes('Awaited') ||
    status.includes('Waiting')
  ) {
    return 'waiting';
  }
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
  const respondLabel = formatCountdown(respondBy, {
    paused,
    met: !!firstResponseAt,
  });
  const resolveLabel = formatCountdown(resolveBy, {
    paused: paused || stopped,
    met: !!resolvedAt,
  });
  return (
    <div className="sla-meter">
      <div className="sla-chip-row">
        <div
          className={`sla-chip${respondLabel === 'Overdue' ? ' overdue' : ''}${firstResponseAt ? ' met' : ''}`}
        >
          <span className="sla-chip-label">First response due</span>
          <span className="sla-chip-value tabular-nums">{respondLabel}</span>
        </div>
        <div
          className={`sla-chip${resolveLabel === 'Overdue' ? ' overdue' : ''}${resolvedAt ? ' met' : ''}`}
        >
          <span className="sla-chip-label">Resolution due</span>
          <span className="sla-chip-value tabular-nums">{resolveLabel}</span>
        </div>
      </div>
      <div className="sla-row">
        <span className="sla-label">First response by</span>
        <span className="sla-value">
          {respondBy
            ? new Date(respondBy).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : '—'}
        </span>
      </div>
      <div className="sla-row">
        <span className="sla-label">Resolve by</span>
        <span className="sla-value">
          {resolveBy
            ? new Date(resolveBy).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : '—'}
        </span>
      </div>
      {breached ? <p className="sla-breach-note">Breach recorded on this ticket.</p> : null}
    </div>
  );
}

export function AttachmentCard({
  id,
  filename,
  sizeBytes,
  storageKey,
}: {
  id: number;
  filename: string;
  sizeBytes?: number | null;
  storageKey?: string | null;
}) {
  const size = formatFileSize(sizeBytes);
  const ext = filename.includes('.') ? filename.split('.').pop()?.toUpperCase() : 'FILE';
  const inner = (
    <>
      <span className="attachment-icon" aria-hidden>
        <span className="attachment-ext">{ext?.slice(0, 4)}</span>
      </span>
      <span className="attachment-meta">
        <span className="attachment-name">{filename}</span>
        {size ? <span className="attachment-size">{size}</span> : null}
      </span>
    </>
  );
  if (storageKey) {
    return (
      <a className="attachment-card" href={`/api/attachments/${id}`}>
        {inner}
      </a>
    );
  }
  return <div className="attachment-card attachment-card-static">{inner}</div>;
}
