import { apiError, apiOk, parsePagination } from '@/lib/api';
import { getSessionUser, isStaff, userCan } from '@/lib/auth';
import { ensureDb } from '@/lib/init';
import { findOrCreateRequester, createTicket, listTickets } from '@/lib/tickets';
import { incrementMetric, logEvent } from '@/lib/observability';

export async function GET(request: Request) {
  ensureDb();
  const user = await getSessionUser();
  if (!user || !isStaff(user) || !userCan(user, 'api.access')) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const url = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(url);
  const q = url.searchParams.get('q') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const groupName =
    user.role === 'agent' ? user.group_name ?? undefined : url.searchParams.get('group') ?? undefined;

  const all = listTickets({
    groupName,
    statusName: status || undefined,
    search: q,
    sortBy: 'updated_at',
    sortDir: 'desc',
  });
  const slice = all.slice(offset, offset + pageSize);
  incrementMetric('api.tickets.list');
  logEvent('info', 'api.tickets.list', { userId: user.id, total: all.length });
  return apiOk(
    slice.map((t) => ({
      id: t.id,
      display_number: t.display_number,
      subject: t.subject,
      status: t.status_name,
      priority: t.priority,
      requester: t.requester_name,
      assignee: t.assignee_name,
      group: t.group_name,
      category: t.category,
      updated_at: t.updated_at,
    })),
    { page, pageSize, total: all.length },
  );
}

export async function POST(request: Request) {
  ensureDb();
  const user = await getSessionUser();
  if (!user || !isStaff(user) || !userCan(user, 'api.access')) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError('INVALID_JSON', 'Request body must be JSON', 400);
  }

  const subject = String(body.subject ?? '').trim();
  const description = String(body.description ?? '').trim();
  const supportTeam = String(body.support_team ?? body.supportTeam ?? 'Tech Support Team').trim();
  const requesterEmail = String(body.requester_email ?? body.requesterEmail ?? '').trim();
  const sourceRaw = String(body.source ?? 'other');
  const source =
    sourceRaw === 'portal' || sourceRaw === 'email' || sourceRaw === 'phone' || sourceRaw === 'other'
      ? sourceRaw
      : 'other';

  if (!subject || !description) {
    return apiError('VALIDATION', 'subject and description are required', 400);
  }
  if (!requesterEmail || !requesterEmail.includes('@')) {
    return apiError('VALIDATION', 'requester_email is required', 400);
  }

  const requesterId = findOrCreateRequester(
    requesterEmail,
    body.requester_name ? String(body.requester_name) : undefined,
  );
  const ticket = createTicket({
    subject,
    description,
    supportTeam,
    requesterId,
    source,
    actorId: user.id,
  });
  if (!ticket) {
    return apiError('CREATE_FAILED', 'Could not create ticket', 500);
  }

  incrementMetric('api.tickets.create');
  logEvent('info', 'api.tickets.create', { userId: user.id, ticketId: ticket.id });
  return apiOk(
    {
      id: ticket.id,
      display_number: ticket.display_number,
      subject: ticket.subject,
      status: ticket.status.name,
      source,
    },
    { status: 201 },
  );
}
