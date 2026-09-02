import { PublicShell } from '@/components/PublicShell';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
