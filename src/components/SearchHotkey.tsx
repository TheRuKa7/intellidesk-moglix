'use client';

import { useEffect } from 'react';

/** Focus the desk search when `/` is pressed (not while typing in inputs). */
export function SearchHotkey({ inputId = 'desk-search-q' }: { inputId?: string }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      const el = document.getElementById(inputId) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inputId]);

  return null;
}
