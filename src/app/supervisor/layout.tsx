import { DeskShell } from '@/components/DeskShell';
import { requireStaffRoleOrRedirect } from '@/lib/auth';

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  await requireStaffRoleOrRedirect(['supervisor', 'admin']);
  return <DeskShell>{children}</DeskShell>;
}
