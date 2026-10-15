'use client';

import { useSearchParams } from 'next/navigation';

export function DeskSearch() {
  const searchParams = useSearchParams();
  const view = searchParams.get('view') ?? 'open';

  return (
    <form className="desk-search" action="/agent" method="get">
      <input type="hidden" name="view" value={view} />
      <span className="desk-search-icon" aria-hidden>
        <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
          <path d="M8.5 3a5.5 5.5 0 014.2 9l3.1 3.2-1.1 1.1-3.2-3.1A5.5 5.5 0 118.5 3zm0 1.5a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      </span>
      <input
        id="desk-search-q"
        name="q"
        type="search"
        placeholder="Search tickets by subject or INC…"
        aria-label="Search tickets"
        autoComplete="off"
        defaultValue={searchParams.get('q') ?? ''}
      />
      <kbd className="kbd">/</kbd>
    </form>
  );
}
