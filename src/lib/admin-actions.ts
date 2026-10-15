'use server';

import { redirect } from 'next/navigation';
import { requireStaffRoleOrRedirect, userCan } from '@/lib/auth';
import { setSetting } from '@/lib/platform';

export async function saveAccountSettingsAction(formData: FormData) {
  const user = await requireStaffRoleOrRedirect(['admin']);
  if (!userCan(user, 'admin.settings')) redirect('/admin');
  for (const key of ['locale', 'timezone', 'date_format', 'currency', 'ticket_id_prefix']) {
    if (formData.has(key)) {
      setSetting(`account.${key}`, String(formData.get(key) ?? ''), user.id);
    }
  }
  redirect('/admin/settings?saved=1');
}

export async function saveSecuritySettingsAction(formData: FormData) {
  const user = await requireStaffRoleOrRedirect(['admin']);
  if (!userCan(user, 'admin.security')) redirect('/admin');
  for (const key of [
    'session_lifetime_hours',
    'public_url_auth',
    'ticket_sharing',
    'allowed_email_domains',
    'max_attachment_mb',
    'force_logout_enabled',
  ]) {
    if (formData.has(key)) {
      setSetting(`security.${key}`, String(formData.get(key) ?? ''), user.id);
    }
  }
  redirect('/admin/security?saved=1');
}
