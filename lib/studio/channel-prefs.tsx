"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { studioApi, type ChannelPrefs } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";

interface ChannelPrefsValue {
  /** The active studio's per-channel enabled prefs; null until loaded. */
  prefs: ChannelPrefs | null;
  /** Push a known-current value (after a toggle) so every reader updates at once. */
  sync: (prefs: ChannelPrefs) => void;
  refresh: () => void;
}

const ChannelPrefsContext = createContext<ChannelPrefsValue | null>(null);

/**
 * Shared channel on/off prefs for the active studio. The sidebar dots read them
 * here, and the channel pages push every change back through `sync`, so turning
 * a channel on or off shows in the sidebar without a reload.
 */
export function ChannelPrefsProvider({ children }: { children: ReactNode }) {
  const { entityId } = useActiveEntity();
  // Keyed by studio so a switch never shows the previous studio's dots.
  const [loaded, setLoaded] = useState<{ entityId: string; prefs: ChannelPrefs } | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    studioApi
      .getChannelPrefs(entityId)
      .then((res) => {
        if (!cancelled) setLoaded({ entityId, prefs: res.data });
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [entityId, nonce]);

  const prefs = loaded && loaded.entityId === entityId ? loaded.prefs : null;
  const sync = useCallback(
    (next: ChannelPrefs) => {
      if (entityId) setLoaded({ entityId, prefs: next });
    },
    [entityId],
  );
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const value = useMemo(() => ({ prefs, sync, refresh }), [prefs, sync, refresh]);

  return <ChannelPrefsContext.Provider value={value}>{children}</ChannelPrefsContext.Provider>;
}

export function useChannelPrefs(): ChannelPrefsValue {
  const ctx = useContext(ChannelPrefsContext);
  if (!ctx) throw new Error("useChannelPrefs must be used inside ChannelPrefsProvider");
  return ctx;
}
