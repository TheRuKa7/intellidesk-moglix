'use client';

import { useEffect, useState } from 'react';

export function FlashBanner({
  variant,
  children,
}: {
  variant: 'success' | 'info' | 'warn';
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    const flashKeys = [
      'created',
      'notice',
      'error',
      'saved',
      'released',
      'max',
      'updated',
      'suppressed',
      'tid',
    ];
    let dirty = false;
    for (const key of flashKeys) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        dirty = true;
      }
    }
    if (dirty) {
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, '', next);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setOpen(false), 6000);
    return () => window.clearTimeout(t);
  }, []);

  if (!open) return null;

  return (
    <div className={`banner banner-${variant} banner-flash`} role="status" aria-live="polite">
      <div className="banner-flash-body">{children}</div>
      <button
        type="button"
        className="banner-dismiss"
        aria-label="Dismiss"
        onClick={() => setOpen(false)}
      >
        ×
      </button>
    </div>
  );
}
