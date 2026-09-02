import { PortalShell } from '@/components/PortalShell';
import { requireRequesterOrRedirect } from '@/lib/auth';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireRequesterOrRedirect();
  return <PortalShell>{children}</PortalShell>;
}
