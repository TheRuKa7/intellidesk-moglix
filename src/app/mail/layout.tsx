import { DeskShell } from '@/components/DeskShell';
import { requireStaffOrRedirect } from '@/lib/auth';

export default async function MailLayout({ children }: { children: React.ReactNode }) {
  await requireStaffOrRedirect();
  return <DeskShell>{children}</DeskShell>;
}
