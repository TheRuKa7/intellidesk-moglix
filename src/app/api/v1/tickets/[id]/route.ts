import { apiError, apiOk } from '@/lib/api';
import { canViewTicket, getSessionUser, isStaff, userCan } from '@/lib/auth';
import { ensureDb } from '@/lib/init';
import { getTicketById, updateTicket } from '@/lib/tickets';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  ensureDb();
  const user = await getSessionUser();
  if (!user || !isStaff(user) || !userCan(user, 'api.access')) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const { id } = await context.params;
  const ticket = getTicketById(Number(id));
  if (!ticket || !canViewTicket(user, ticket as never)) {
    return apiError('NOT_FOUND', 'Ticket not found', 404);
  }
  return apiOk({
    id: ticket.id,
    display_number: ticket.display_number,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status.name,
    priority: ticket.priority,
    category: ticket.category,
    subcategory: ticket.subcategory,
    requester: ticket.requester,
    assignee: ticket.assignee,
    group_name: ticket.group_name,
    messages: ticket.messages,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  ensureDb();
  const user = await getSessionUser();
  if (!user || !isStaff(user) || !userCan(user, 'api.access')) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const { id } = await context.params;
  const ticketId = Number(id);
  const existing = getTicketById(ticketId);
  if (!existing || !canViewTicket(user, existing as never)) {
    return apiError('NOT_FOUND', 'Ticket not found', 404);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError('INVALID_JSON', 'Request body must be JSON', 400);
  }

  try {
    const updated = updateTicket({
      ticketId,
      actorId: user.id,
      statusName: body.status ? String(body.status) : undefined,
      priority: body.priority ? String(body.priority) : undefined,
      category: body.category !== undefined ? String(body.category) : undefined,
      subcategory: body.subcategory !== undefined ? String(body.subcategory) : undefined,
      resolutionNote: body.resolution_note ? String(body.resolution_note) : undefined,
      assigneeId:
        body.assignee_id === undefined
          ? undefined
          : body.assignee_id === null || body.assignee_id === ''
            ? null
            : Number(body.assignee_id),
    });
    return apiOk({
      id: updated?.id,
      display_number: updated?.display_number,
      status: updated?.status.name,
      priority: updated?.priority,
      assignee_id: updated?.assignee_id,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'RESOLUTION_NOTE_REQUIRED') {
      return apiError('RESOLUTION_NOTE_REQUIRED', 'resolution_note is required to resolve', 400);
    }
    throw e;
  }
}
