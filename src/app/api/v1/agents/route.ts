import { apiError, apiOk, parsePagination } from '@/lib/api';
import { getSessionUser, userCan } from '@/lib/auth';
import { ensureDb } from '@/lib/init';
import { listAgents } from '@/lib/platform';

export async function GET(request: Request) {
  ensureDb();
  const user = await getSessionUser();
  if (!user || !userCan(user, 'admin.users')) {
    return apiError('FORBIDDEN', 'Admin users privilege required', 403);
  }
  const url = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(url);
  const all = listAgents();
  return apiOk(all.slice(offset, offset + pageSize), {
    page,
    pageSize,
    total: all.length,
  });
}
