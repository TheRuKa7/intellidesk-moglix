import { apiError, apiOk } from '@/lib/api';
import { getSessionUser, isStaff } from '@/lib/auth';
import { ensureDb } from '@/lib/init';
import { listNotifications, markNotificationRead } from '@/lib/platform';

export async function GET(request: Request) {
  ensureDb();
  const user = await getSessionUser();
  if (!user || !isStaff(user)) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unread') === '1';
  return apiOk(listNotifications(user.id, unreadOnly));
}

export async function POST(request: Request) {
  ensureDb();
  const user = await getSessionUser();
  if (!user || !isStaff(user)) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const body = (await request.json()) as { id?: number };
  if (!body.id) return apiError('VALIDATION', 'id required');
  markNotificationRead(body.id, user.id);
  return apiOk({ ok: true });
}
