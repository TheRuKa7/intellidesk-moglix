'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaffRoleOrRedirect, userCan } from '@/lib/auth';
import {
  createDepartment,
  createDirectoryUser,
  createGroup,
  createMailbox,
  createRole,
  setUserActive,
} from '@/lib/platform';

function revalidateDirectory() {
  revalidatePath('/admin/agents');
  revalidatePath('/admin/requesters');
  revalidatePath('/admin/groups');
  revalidatePath('/admin/departments');
  revalidatePath('/admin/privileges');
  revalidatePath('/agent');
}

export async function createAgentAction(formData: FormData) {
  const user = await requireStaffRoleOrRedirect(['admin', 'supervisor']);
  if (!userCan(user, 'admin.users')) redirect('/admin');
  const roleRaw = String(formData.get('role') || 'agent');
  const role = (['agent', 'supervisor', 'admin'].includes(roleRaw) ? roleRaw : 'agent') as
    | 'agent'
    | 'supervisor'
    | 'admin';
  try {
    createDirectoryUser({
      email: String(formData.get('email') || ''),
      name: String(formData.get('name') || ''),
      role,
      groupName: String(formData.get('group_name') || '') || null,
      department: String(formData.get('department') || '') || null,
      actorId: user.id,
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : 'FAILED';
    redirect(`/admin/agents?error=${encodeURIComponent(code)}`);
  }
  revalidateDirectory();
  redirect('/admin/agents?created=1');
}

export async function createRequesterAction(formData: FormData) {
  const user = await requireStaffRoleOrRedirect(['admin', 'supervisor']);
  if (!userCan(user, 'admin.users')) redirect('/admin');
  try {
    createDirectoryUser({
      email: String(formData.get('email') || ''),
      name: String(formData.get('name') || ''),
      role: 'requester',
      department: String(formData.get('department') || '') || null,
      actorId: user.id,
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : 'FAILED';
    redirect(`/admin/requesters?error=${encodeURIComponent(code)}`);
  }
  revalidateDirectory();
  redirect('/admin/requesters?created=1');
}

export async function toggleUserActiveAction(formData: FormData) {
  const user = await requireStaffRoleOrRedirect(['admin', 'supervisor']);
  if (!userCan(user, 'admin.users')) redirect('/admin');
  const userId = Number(formData.get('user_id'));
  const active = String(formData.get('active') || '1') === '1';
  const returnTo = String(formData.get('return_to') || '/admin/agents');
  setUserActive(userId, active, user.id);
  revalidateDirectory();
  redirect(`${returnTo}?updated=1`);
}

export async function createGroupAction(formData: FormData) {
  const user = await requireStaffRoleOrRedirect(['admin', 'supervisor']);
  if (!userCan(user, 'admin.groups')) redirect('/admin');
  try {
    createGroup({
      name: String(formData.get('name') || ''),
      mailbox: String(formData.get('mailbox') || '') || null,
      autoAssign: formData.get('auto_assign') === '1',
      actorId: user.id,
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : 'FAILED';
    redirect(`/admin/groups?error=${encodeURIComponent(code)}`);
  }
  revalidateDirectory();
  redirect('/admin/groups?created=1');
}

export async function createDepartmentAction(formData: FormData) {
  const user = await requireStaffRoleOrRedirect(['admin', 'supervisor']);
  if (!userCan(user, 'admin.users')) redirect('/admin');
  try {
    createDepartment({
      name: String(formData.get('name') || ''),
      approverEmail: String(formData.get('approver_email') || '') || null,
      actorId: user.id,
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : 'FAILED';
    redirect(`/admin/departments?error=${encodeURIComponent(code)}`);
  }
  revalidateDirectory();
  redirect('/admin/departments?created=1');
}

export async function createMailboxAction(formData: FormData) {
  const user = await requireStaffRoleOrRedirect(['admin']);
  if (!userCan(user, 'admin.mailboxes')) redirect('/admin');
  try {
    createMailbox({
      name: String(formData.get('name') || ''),
      address: String(formData.get('address') || ''),
      forwardTo: String(formData.get('forward_to') || '') || null,
      groupName: String(formData.get('group_name') || '') || null,
      isPrimary: formData.get('is_primary') === '1',
      actorId: user.id,
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : 'FAILED';
    redirect(`/admin/mailboxes?error=${encodeURIComponent(code)}`);
  }
  revalidateDirectory();
  revalidatePath('/admin/mailboxes');
  redirect('/admin/mailboxes?created=1');
}

export async function createRoleAction(formData: FormData) {
  const user = await requireStaffRoleOrRedirect(['admin']);
  if (!userCan(user, 'admin.privileges')) redirect('/admin');
  const levelRaw = String(formData.get('level') || 'agent');
  const level = (
    ['requester', 'agent', 'supervisor', 'admin'].includes(levelRaw) ? levelRaw : 'agent'
  ) as 'requester' | 'agent' | 'supervisor' | 'admin';
  const privileges = formData.getAll('privilege').map(String);
  try {
    createRole({
      name: String(formData.get('name') || ''),
      level,
      privileges,
      actorId: user.id,
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : 'FAILED';
    redirect(`/admin/privileges?error=${encodeURIComponent(code)}`);
  }
  revalidateDirectory();
  redirect('/admin/privileges?created=1');
}
