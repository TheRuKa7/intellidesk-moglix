import Link from 'next/link';

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app app-public">
      <header className="topbar topbar-public">
        <Link href="/" className="brand">
          <span className="brand-mark">M</span>
          <span className="brand-text">IntelliDesk</span>
        </Link>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
