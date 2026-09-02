import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, type UserRow } from './db';

const SESSION_COOKIE = 'intellidesk_user';

export type UserRole = 'requester' | 'agent' | 'supervisor' | 'admin';

export async function getSessionUser(): Promise<UserRow | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!userId) return null;
  return getDb()
    .prepare('SELECT id, email, name, role, group_name, department FROM users WHERE id = ? AND active = 1')
    .get(Number(userId)) as UserRow | undefined ?? null;
}

export async function setSessionUser(userId: number) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, String(userId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function isRequester(user: UserRow): boolean {
  return user.role === 'requester';
}

export function isStaff(user: UserRow): boolean {
  return user.role === 'agent' || user.role === 'supervisor' || user.role === 'admin';
}

export function getRequesterHome(): string {
  return '/portal';
}

export function getStaffHome(user: UserRow): string {
  return getStaffHomeForRole(user.role);
}

export function getStaffHomeForRole(role: string): string {
  if (role === 'supervisor') return '/supervisor';
  return '/agent';
}

export async function requireAuthOrRedirect(): Promise<UserRow> {
  const user = await getSessionUser();
  if (!user) redirect('/');
  return user;
}

export async function requireRequesterOrRedirect(): Promise<UserRow> {
  const user = await requireAuthOrRedirect();
  if (!isRequester(user)) redirect(getStaffHome(user));
  return user;
}

export async function requireStaffOrRedirect(): Promise<UserRow> {
  const user = await requireAuthOrRedirect();
  if (!isStaff(user)) redirect(getRequesterHome());
  return user;
}

export async function requireStaffRoleOrRedirect(roles: UserRole[]): Promise<UserRow> {
  const user = await requireStaffOrRedirect();
  if (!roles.includes(user.role as UserRole)) {
    redirect(getStaffHome(user));
  }
  return user;
}

export async function requireRole(roles: string[]): Promise<UserRow> {
  const user = await getSessionUser();
  if (!user || !roles.includes(user.role)) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

export function canViewTicket(user: UserRow, ticket: { group_name: string; assignee_id: number | null; requester_id: number }) {
  if (user.role === 'admin' || user.role === 'supervisor') return true;
  if (user.role === 'requester') return ticket.requester_id === user.id;
  if (user.role === 'agent') {
    if (!user.group_name) return true;
    return ticket.group_name === user.group_name;
  }
  return false;
}

export function getTicketAccessRow(ticketId: number) {
  return getDb()
    .prepare('SELECT id, group_name, assignee_id, requester_id FROM tickets WHERE id = ? AND deleted = 0')
    .get(ticketId) as
    | { id: number; group_name: string; assignee_id: number | null; requester_id: number }
    | undefined;
}

export async function requireTicketAccessOrNotFound(user: UserRow, ticketId: number) {
  const ticket = getTicketAccessRow(ticketId);
  if (!ticket || !canViewTicket(user, ticket)) {
    const { notFound } = await import('next/navigation');
    notFound();
  }
  return ticket;
}

export function staffTicketPath(ticketId: number): string {
  return `/agent/tickets/${ticketId}`;
}

export function requesterTicketPath(ticketId: number): string {
  return `/portal/tickets/${ticketId}`;
}

export function ticketPathForUser(user: UserRow, ticketId: number): string {
  return isRequester(user) ? requesterTicketPath(ticketId) : staffTicketPath(ticketId);
}
