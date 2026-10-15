import { apiError, apiOk } from '@/lib/api';
import { forceLogoutUser, getSessionUser, userCan } from '@/lib/auth';
import { ensureDb } from '@/lib/init';

export async function POST(request: Request) {
  ensureDb();
  const user = await getSessionUser();
  if (!user || !userCan(user, 'admin.security')) {
    return apiError('FORBIDDEN', 'Security admin required', 403);
  }
  const body = (await request.json()) as { user_id?: number };
  if (!body.user_id) return apiError('VALIDATION', 'user_id required');
  await forceLogoutUser(body.user_id, user.id);
  return apiOk({ revoked: true, user_id: body.user_id });
}
