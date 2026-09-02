'use server';

import { redirect } from 'next/navigation';
import { COMMERCE_FIELDS } from '@/lib/constants';
import { requireStaffOrRedirect, requireTicketAccessOrNotFound } from '@/lib/auth';
import { addMessage, pickupTicket, updateTicket } from '@/lib/tickets';

export async function agentReplyAction(formData: FormData) {
  const user = await requireStaffOrRedirect();
  const ticketId = Number(formData.get('ticket_id'));
  await requireTicketAccessOrNotFound(user, ticketId);
  const type = formData.get('type') === 'note' ? 'note' : 'public';
  addMessage({
    ticketId,
    authorId: user.id,
    body: String(formData.get('body')),
    type,
    actorId: user.id,
  });
  redirect(`/agent/tickets/${ticketId}?saved=1`);
}

export async function agentUpdateTicketAction(formData: FormData) {
  const user = await requireStaffOrRedirect();
  const ticketId = Number(formData.get('ticket_id'));
  await requireTicketAccessOrNotFound(user, ticketId);
  const statusName = formData.has('status') ? String(formData.get('status')) : undefined;
  const assigneeRaw = formData.has('assignee_id') ? formData.get('assignee_id') : undefined;
  const resolutionNote = formData.has('resolution_note')
    ? String(formData.get('resolution_note') || '') || undefined
    : undefined;
  const breachReason = formData.has('breach_reason')
    ? String(formData.get('breach_reason') || '')
    : undefined;
  const supportTeam = formData.has('support_team') ? String(formData.get('support_team') || '') : undefined;

  const customFields: Record<string, string> = {};
  for (const field of COMMERCE_FIELDS) {
    if (field === 'support_team') continue;
    if (formData.has(field)) {
      customFields[field] = String(formData.get(field) ?? '');
    }
  }

  try {
    updateTicket({
      ticketId,
      actorId: user.id,
      statusName: statusName || undefined,
      assigneeId:
        assigneeRaw === undefined ? undefined : assigneeRaw === '' ? null : Number(assigneeRaw),
      resolutionNote,
      breachReason,
      supportTeam: supportTeam || undefined,
      customFields: Object.keys(customFields).length ? customFields : undefined,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'RESOLUTION_NOTE_REQUIRED') {
      redirect(`/agent/tickets/${ticketId}?error=resolution`);
    }
    throw e;
  }
  redirect(`/agent/tickets/${ticketId}?saved=1`);
}

export async function agentPickupAction(formData: FormData) {
  const user = await requireStaffOrRedirect();
  const ticketId = Number(formData.get('ticket_id'));
  await requireTicketAccessOrNotFound(user, ticketId);
  pickupTicket(ticketId, user.id);
  redirect(`/agent/tickets/${ticketId}?saved=1`);
}
