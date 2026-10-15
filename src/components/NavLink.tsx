'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export function NavLink({
  href,
  className,
  activeClassName,
  exact,
  children,
}: {
  href: string;
  className: string;
  activeClassName: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = new URL(href, 'http://local.invalid');
  const pathMatch = exact
    ? pathname === url.pathname
    : pathname === url.pathname || pathname.startsWith(`${url.pathname}/`);

  let active = false;
  if (pathMatch) {
    if (url.searchParams.has('view')) {
      const want = url.searchParams.get('view');
      const have = searchParams.get('view') ?? 'open';
      active = have === want && pathname === url.pathname;
    } else if (exact) {
      active = pathname === url.pathname;
    } else {
      active = true;
    }
  } else if (url.pathname === '/admin' && (pathname === '/mail' || pathname.startsWith('/mail/'))) {
    active = true;
  }

  return (
    <Link href={href} className={`${className}${active ? ` ${activeClassName}` : ''}`}>
      {children}
    </Link>
  );
}
