"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { studioApi } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";

/**
 * Shared state for the studio settings sub-pages (General / Branding / Hours).
 *
 * The entity profile is fetched once for the whole settings section so switching
 * tabs doesn't refetch, and a save in one sub-page updates the cache the others
 * read from. Sub-pages that own unrelated data (Policies, Payouts) fetch their
 * own slice — they only read `canEdit` from here.
 */
interface SettingsContextValue {
  entity: any | null;
  loading: boolean;
  canEdit: boolean;
  /** Re-fetch the profile from the API. */
  refresh: () => Promise<void>;
  /** Persist a partial profile patch; the backend merges only provided fields. */
  updateProfile: (patch: Record<string, any>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { entityId, role } = useActiveEntity();
  const [entity, setEntity] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const canEdit = role === "manager" || role === "owner";

  const refresh = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await studioApi.getProfile(entityId);
      setEntity(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateProfile = useCallback(
    async (patch: Record<string, any>) => {
      if (!entityId) return;
      const res = await studioApi.updateProfile(entityId, patch);
      setEntity((prev: any) => ({ ...prev, ...res.data }));
    },
    [entityId],
  );

  return (
    <SettingsContext.Provider
      value={{ entity, loading, canEdit, refresh, updateProfile }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}
