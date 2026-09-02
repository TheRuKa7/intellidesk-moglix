export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

export function formatStatusLabel(name: string, forRequester = false): string {
  if (!forRequester) return name;
  return name.toUpperCase();
}

export function slaRemaining(deadline: string | null, paused: boolean): string {
  if (!deadline) return '—';
  if (paused) return 'Paused';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Overdue';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
  return `${hours}h ${mins}m left`;
}

export function isOverdue(
  respondBy: string | null,
  resolveBy: string | null,
  firstResponseAt: string | null,
  resolvedAt: string | null,
  slaClock: string,
): boolean {
  if (slaClock === 'pause' || slaClock === 'stop') return false;
  const now = Date.now();
  if (!firstResponseAt && respondBy && now > new Date(respondBy).getTime()) return true;
  if (!resolvedAt && resolveBy && now > new Date(resolveBy).getTime()) return true;
  return false;
}
