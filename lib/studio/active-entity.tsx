"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/provider";
import { studioApi } from "@/lib/api/studio";
import type { EntityMembership } from "@/lib/auth/roles";

const IMPERSONATE_KEY = "moovli_impersonate_entity";

export interface ActiveEntity {
  /** The studio currently being operated on (selected, or admin-impersonated). */
  entityId: string | null;
  entityName: string | null;
  /** Effective role in this studio. Admins act as "owner". */
  role: "owner" | "manager" | "staff";
  currencyCode: string;
  onboardedAt: string | null;
  /** True when an admin is viewing a studio they don't actually belong to. */
  isImpersonating: boolean;
  /** Studios the user genuinely belongs to (for the switcher). */
  entities: EntityMembership[];
  setSelectedEntityId: (id: string) => void;
  exitImpersonation: () => void;
}

const ActiveEntityContext = createContext<ActiveEntity | null>(null);

export function ActiveEntityProvider({ children }: { children: ReactNode }) {
  const { roles } = useAuth();
  const searchParams = useSearchParams();
  const entities = useMemo(() => roles?.ownedEntities ?? [], [roles]);

  // Owner-side selection (drives the multi-studio switcher).
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  useEffect(() => {
    if (entities.length > 0 && !selectedEntityId) {
      setSelectedEntityId(entities[0].entityId);
    }
  }, [entities, selectedEntityId]);

  // Admin impersonation target: read from `?as=<entityId>`, persisted to
  // sessionStorage so it survives in-app navigation that drops the query param.
  const [impersonateId, setImpersonateId] = useState<string | null>(null);
  const asParam = searchParams.get("as");
  useEffect(() => {
    if (!roles?.isAdmin) return;
    if (asParam) {
      setImpersonateId(asParam);
      try {
        sessionStorage.setItem(IMPERSONATE_KEY, asParam);
      } catch {
        /* sessionStorage unavailable — fall back to in-memory only */
      }
      return;
    }
    try {
      const stored = sessionStorage.getItem(IMPERSONATE_KEY);
      if (stored) setImpersonateId(stored);
    } catch {
      /* ignore */
    }
  }, [asParam, roles]);

  // An impersonation is only "real" when the target isn't a studio the admin
  // actually belongs to (otherwise treat it as a normal membership).
  const ownsImpersonated = entities.some((e) => e.entityId === impersonateId);
  const isImpersonating = !!(roles?.isAdmin && impersonateId && !ownsImpersonated);

  // When impersonating, the admin's roles carry no name/currency for the target,
  // so fetch the studio profile for display.
  const [impersonatedProfile, setImpersonatedProfile] = useState<{
    name: string;
    currency: string;
  } | null>(null);
  useEffect(() => {
    if (!isImpersonating || !impersonateId) {
      setImpersonatedProfile(null);
      return;
    }
    let cancelled = false;
    studioApi
      .getProfile(impersonateId)
      .then((res) => {
        if (cancelled) return;
        setImpersonatedProfile({
          name: res.data?.name ?? "Studio",
          currency: res.data?.currency_code ?? "MAD",
        });
      })
      .catch(() => setImpersonatedProfile({ name: "Studio", currency: "MAD" }));
    return () => {
      cancelled = true;
    };
  }, [isImpersonating, impersonateId]);

  const exitImpersonation = () => {
    setImpersonateId(null);
    try {
      sessionStorage.removeItem(IMPERSONATE_KEY);
    } catch {
      /* ignore */
    }
  };

  const value = useMemo<ActiveEntity>(() => {
    if (isImpersonating && impersonateId) {
      return {
        entityId: impersonateId,
        entityName: impersonatedProfile?.name ?? null,
        role: "owner",
        currencyCode: impersonatedProfile?.currency ?? "MAD",
        onboardedAt: new Date(0).toISOString(), // treat as onboarded — never gate admins to the wizard
        isImpersonating: true,
        entities,
        setSelectedEntityId,
        exitImpersonation,
      };
    }
    const active =
      entities.find((e) => e.entityId === selectedEntityId) ?? entities[0] ?? null;
    return {
      entityId: active?.entityId ?? null,
      entityName: active?.entityName ?? null,
      role: roles?.isAdmin ? "owner" : active?.role ?? "staff",
      currencyCode: active?.currencyCode ?? "MAD",
      onboardedAt: active?.onboardedAt ?? null,
      isImpersonating: false,
      entities,
      setSelectedEntityId,
      exitImpersonation,
    };
  }, [isImpersonating, impersonateId, impersonatedProfile, entities, selectedEntityId, roles]);

  return (
    <ActiveEntityContext.Provider value={value}>{children}</ActiveEntityContext.Provider>
  );
}

/** Current studio being operated on (owner selection or admin impersonation). */
export function useActiveEntity(): ActiveEntity {
  const ctx = useContext(ActiveEntityContext);
  if (!ctx) {
    throw new Error("useActiveEntity must be used within ActiveEntityProvider");
  }
  return ctx;
}
