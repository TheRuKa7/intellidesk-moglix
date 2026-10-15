'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { COMMERCE_FIELDS } from '@/lib/constants';
import { requireStaffOrRedirect, requireTicketAccessOrNotFound } from '@/lib/auth';
import { unwatchTicket, watchTicket } from '@/lib/platform';
import { addMessage, forwardTicket, getTicketByNumber, pickupTicket, updateTicket } from '@/lib/tickets';
import { acquireTicketLock, releaseTicketLock, renewTicketLock } from '@/lib/ticket-lock';
import {
  addTicketTag,
  linkTickets,
  mergeTickets,
  removeTicketTag,
} from '@/lib/ticket-relations';

function queueViewFromForm(formData: FormData): string {
  return String(formData.get('return_view') || '').trim();
}

function ticketUrl(
  ticketId: number,
  formData: FormData,
  extras: Record<string, string>,
): string {
  const params = new URLSearchParams(extras);
  const view = queueViewFromForm(formData);
  if (view && view !== 'open') params.set('view', view);
  const qs = params.toString();
  return qs ? `/agent/tickets/${ticketId}?${qs}` : `/agent/tickets/${ticketId}`;
}

function ticketRedirect(ticketId: number, formData: FormData, notice: string, tab?: string) {
  revalidatePath(`/agent/tickets/${ticketId}`);
  revalidatePath('/agent');
  revalidatePath('/notifications');
  const extras: Record<string, string> = { notice };
  if (tab) extras.tab = tab;
  redirect(ticketUrl(ticketId, formData, extras));
}

export async function agentReplyAction(formData: FormData) {
  const user = await requireStaffOrRedirect();
  const ticketId = Number(formData.get('ticket_id'));
  await requireTicketAccessOrNotFound(user, ticketId);
  const rawType = String(formData.get('type') ?? 'public');
  if (rawType === 'forward') {
    const to = String(formData.get('forward_to') ?? '').trim();
    const body = String(formData.get('body') ?? '');
    if (!to) redirect(ticketUrl(ticketId, formData, { error: 'forward' }));
    forwardTicket({ ticketId, actorId: user.id, to, body });
    ticketRedirect(ticketId, formData, 'forwarded', 'details');
  }
  const type = rawType === 'note' ? 'note' : 'public';
  const body = String(formData.get('body') ?? '').trim();
  if (!body) redirect(ticketUrl(ticketId, formData, { error: 'empty' }));
  addMessage({
    ticketId,
    authorId: user.id,
    body,
    type,
    actorId: user.id,
  });
  renewTicketLock(ticketId, user.id);
  ticketRedirect(ticketId, formData, type === 'note' ? 'noted' : 'replied', 'details');
}

export async function agentCloseAction(formData: FormData) {
  const user = await requireStaffOrRedirect();
  const ticketId = Number(formData.get('ticket_id'));
  await requireTicketAccessOrNotFound(user, ticketId);
  updateTicket({
    ticketId,
    actorId: user.id,
    statusName: 'Closed',
  });
  releaseTicketLock(ticketId, user.id);
  ticketRedirect(ticketId, formData, 'closed');
}

export async function agentWatchAction(formData: FormData) {
  const user = await requireStaffOrRedirect();
  const ticketId = Number(formData.get('ticket_id'));
  await requireTicketAccessOrNotFound(user, ticketId);
  if (formData.get('watch') === '0') {
    unwatchTicket(ticketId, user.id);
    ticketRedirect(ticketId, formData, 'unwatched');
  }
  watchTicket(ticketId, user.id);
  ticketRedirect(ticketId, formData, 'watched');
}

export async function agentUpdateTicketAction(formData: FormData) {
  const user = await requireStaffOrRedirect();
  const ticketId = Number(formData.get('ticket_id'));
  await requireTicketAccessOrNotFound(user, ticketId);
  const statusName = formData.has('status') ? String(formData.get('status')) : undefined;
  const assigneeRaw = formData.has('assignee_id') ? formData.get('assignee_id') : undefined;
  const priority = formData.has('priority') ? String(formData.get('priority') || '') : undefined;
  const category = formData.has('category') ? String(formData.get('category') || '') : undefined;
  const subcategory = formData.has('subcategory')
    ? String(formData.get('subcategory') || '')
    : undefined;
  const resolutionNote = formData.has('resolution_note')
    ? String(formData.get('resolution_note') || '') || undefined
    : undefined;
  const breachReason = formData.has('breach_reason')
    ? String(formData.get('breach_reason') || '')
    : undefined;
  const supportTeam = formData.has('support_team')
    ? String(formData.get('support_team') || '')
    : undefined;

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
      priority: priority || undefined,
      category,
      subcategory,
      resolutionNote,
      breachReason,
      supportTeam: supportTeam || undefined,
      customFields: Object.keys(customFields).length ? customFields : undefined,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'RESOLUTION_NOTE_REQUIRED') {
      redirect(ticketUrl(ticketId, formData, { error: 'resolution', tab: 'resolution' }));
    }
    throw e;
  }
  renewTicketLock(ticketId, user.id);
  ticketRedirect(ticketId, formData, statusName === 'Resolved' ? 'resolved' : 'updated');
}

export async function agentPickupAction(formData: FormData) {
  const user = await requireStaffOrRedirect();
  const ticketId = Number(formData.get('ticket_id'));
  await requireTicketAccessOrNotFound(user, ticketId);
  pickupTicket(ticketId, user.id);
  acquireTicketLock(ticketId, user.id);
  ticketRedirect(ticketId, formData, 'picked_up');
}

export async function agentMergeAction(formData: FormData) {
  const user = await requireStaffOrRedirect();
  const ticketId = Number(formData.get('ticket_id'));
  await requireTicketAccessOrNotFound(user, ticketId);
  const targetRaw = String(formData.get('merge_into') ?? '').trim();
  if (!targetRaw) redirect(ticketUrl(ticketId, formData, { error: 'merge' }));
  const byNumber = getTicketByNumber(targetRaw.replace(/^#/, ''));
  const targetId = byNumber?.id ? Number(byNumber.id) : Number(targetRaw);
  if (!Number.isFinite(targetId) || targetId === ticketId) {
    redirect(ticketUrl(ticketId, formData, { error: 'merge' }));
  }
  try {
    const target = mergeTickets({ sourceId: ticketId, targetId, actorId: user.id });
    redirect(ticketUrl(target, formData, { notice: 'merged' }));
  } catch {
    redirect(ticketUrl(ticketId, formData, { error: 'merge' }));
  }
}

export async function agentLinkRelatedAction(formData: FormData) {
  const user = await requireStaffOrRedirect();
  const ticketId = Number(formData.get('ticket_id'));
  await requireTicketAccessOrNotFound(user, ticketId);
  const targetRaw = String(formData.get('related_to') ?? '').trim();
  const byNumber = getTicketByNumber(targetRaw.replace(/^#/, ''));
  const targetId = byNumber?.id ? Number(byNumber.id) : Number(targetRaw);
  if (!Number.isFinite(targetId) || targetId === ticketId) {
    redirect(ticketUrl(ticketId, formData, { error: 'link' }));
  }
  try {
    linkTickets({ sourceId: ticketId, targetId, type: 'related', actorId: user.id });
  } catch {
    redirect(ticketUrl(ticketId, formData, { error: 'link' }));
  }
  ticketRedirect(ticketId, formData, 'linked');
}

export async function agentTagAction(formData: FormData) {
  const user = await requireStaffOrRedirect();
  const ticketId = Number(formData.get('ticket_id'));
  await requireTicketAccessOrNotFound(user, ticketId);
  if (formData.get('remove_tag')) {
    removeTicketTag(ticketId, Number(formData.get('remove_tag')), user.id);
    ticketRedirect(ticketId, formData, 'updated');
  }
  const name = String(formData.get('tag') ?? '');
  addTicketTag(ticketId, name, user.id);
  ticketRedirect(ticketId, formData, 'updated');
}

export async function agentLockReleaseAction(formData: FormData) {
  const user = await requireStaffOrRedirect();
  const ticketId = Number(formData.get('ticket_id'));
  await requireTicketAccessOrNotFound(user, ticketId);
  releaseTicketLock(ticketId, user.id);
  ticketRedirect(ticketId, formData, 'updated');
}
