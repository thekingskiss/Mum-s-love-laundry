import { useSyncExternalStore } from 'react';

/** Tailwind's `md` breakpoint: the width where the dashboard switches from the phone layout to the sidebar. */
export const DESKTOP_QUERY = '(min-width: 768px)';

/**
 * Live match state for a CSS media query. Where matchMedia is missing (jsdom in
 * tests, very old browsers) the query is treated as matching `fallback`.
 */
export function useMediaQuery(query, fallback = true) {
  return useSyncExternalStore(
    (callback) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener?.('change', callback);
      return () => list.removeEventListener?.('change', callback);
    },
    () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(query).matches
        : fallback,
    () => fallback
  );
}

export const useIsDesktop = () => useMediaQuery(DESKTOP_QUERY, true);
