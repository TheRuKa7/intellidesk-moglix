import { DeskShell } from '@/components/DeskShell';
import { requireStaffRoleOrRedirect, userCan } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function MailLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffRoleOrRedirect(['admin', 'supervisor']);
  if (!userCan(user, 'admin.mailboxes')) redirect('/agent');
  return <DeskShell>{children}</DeskShell>;
}
