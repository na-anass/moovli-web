"use client";

import { useEffect, useState } from "react";

/**
 * Returns true when the viewport is below `breakpoint` (default Tailwind `sm` = 640px).
 * SSR-safe: returns `false` until first client effect runs.
 */
export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handle = (e: MediaQueryListEvent | MediaQueryList) =>
      setIsMobile("matches" in e ? e.matches : false);
    handle(mql);
    mql.addEventListener("change", handle);
    return () => mql.removeEventListener("change", handle);
  }, [breakpoint]);

  return isMobile;
}
