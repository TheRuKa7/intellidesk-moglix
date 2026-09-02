const BUSINESS_START = 9;
const BUSINESS_END = 18;

export function addBusinessHours(from: Date, hours: number): Date {
  let remaining = hours;
  const result = new Date(from);

  while (remaining > 0) {
    const day = result.getDay();
    if (day === 0 || day === 6) {
      result.setDate(result.getDate() + 1);
      result.setHours(BUSINESS_START, 0, 0, 0);
      continue;
    }

    const hour = result.getHours() + result.getMinutes() / 60;
    if (hour < BUSINESS_START) {
      result.setHours(BUSINESS_START, 0, 0, 0);
      continue;
    }
    if (hour >= BUSINESS_END) {
      result.setDate(result.getDate() + 1);
      result.setHours(BUSINESS_START, 0, 0, 0);
      continue;
    }

    const availableToday = BUSINESS_END - hour;
    const use = Math.min(remaining, availableToday);
    remaining -= use;
    result.setTime(result.getTime() + use * 60 * 60 * 1000);
  }

  return result;
}

export function computeSlaDeadlines(createdAt: Date, supportTeam: string) {
  const isTech = supportTeam === 'Tech Support Team';
  const respondHours = isTech ? 3 : 8;
  const resolveHours = isTech ? 24 : 72;
  return {
    respondBy: addBusinessHours(createdAt, respondHours).toISOString(),
    resolveBy: addBusinessHours(createdAt, resolveHours).toISOString(),
  };
}

export function evaluateSlaBreach(
  slaClock: string,
  respondBy: string | null,
  resolveBy: string | null,
  firstResponseAt: string | null,
  resolvedAt: string | null,
  now = new Date(),
): boolean {
  if (slaClock === 'pause') return false;
  const nowMs = now.getTime();
  if (!firstResponseAt && respondBy && nowMs > new Date(respondBy).getTime()) return true;
  if (!resolvedAt && resolveBy && nowMs > new Date(resolveBy).getTime() && slaClock === 'run') {
    return true;
  }
  return false;
}

/** Prototype: 18 business hours after resolve ≈ 2 business days simplified */
export function shouldAutoClose(resolvedAt: string, now = new Date()): boolean {
  const resolved = new Date(resolvedAt);
  const closeAt = addBusinessHours(resolved, 18);
  return now.getTime() >= closeAt.getTime();
}
