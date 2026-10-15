import { Suspense } from 'react';
import { AdminSubnav } from '@/components/AdminSubnav';
import { DeskShell } from '@/components/DeskShell';
import { requireStaffRoleOrRedirect } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffRoleOrRedirect(['admin', 'supervisor']);
  return (
    <DeskShell>
      <div className="admin-chrome">
        <Suspense fallback={<nav className="admin-subnav" aria-hidden />}>
          <AdminSubnav user={user} />
        </Suspense>
        <div className="admin-content">{children}</div>
      </div>
    </DeskShell>
  );
}
