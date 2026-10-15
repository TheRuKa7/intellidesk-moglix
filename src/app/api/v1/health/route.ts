import { apiError, apiOk } from '@/lib/api';
import { ensureDb } from '@/lib/init';
import { getMetrics, getRecentEvents } from '@/lib/observability';

export async function GET() {
  ensureDb();
  return apiOk({
    status: 'ok',
    metrics: getMetrics(),
    recent_events: getRecentEvents(20),
  });
}
