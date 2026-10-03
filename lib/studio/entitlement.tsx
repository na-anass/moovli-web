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
import {
  entityPlansApi,
  type ChannelType,
  type EntityPlan,
  type EntitySubscription,
} from "@/lib/api/entityPlans";
import { useActiveEntity } from "@/lib/studio/active-entity";
import {
  CHANNEL_CAPABILITY_BY_TYPE,
  type CapabilityAccess,
  type CapabilityKey,
  type PlanCapability,
  type ResolvedEntitlements,
} from "@/lib/entitlements/capabilities";

/**
 * Why a channel is or isn't available to the active studio — the single vocabulary
 * every plan-gated view shares so copy never contradicts /studio/billing:
 *  - "allowed"          → the active plan grants this channel; show the real feature.
 *  - "not_in_plan"      → a plan is active but doesn't include this channel → UPGRADE.
 *  - "no_subscription"  → no active/trialing subscription at all → CHOOSE A PLAN.
 * The backend only resolves `plan` when a subscription is active/trialing, so a null
 * plan is unambiguously "no_subscription" (matches billing's "No active plan").
 */
export type ChannelAccess = "allowed" | "not_in_plan" | "no_subscription";

interface EntitlementValue {
  loading: boolean;
  plan: EntityPlan | null;
  subscription: EntitySubscription | null;
  /** A subscription is active/trialing and a plan is resolved. */
  hasActivePlan: boolean;
  /** Channels the active plan grants (empty when no active plan). */
  allowedChannels: ChannelType[];
  /** True only when the active plan grants this channel type. */
  allows: (channel: ChannelType) => boolean;
  /** Classify why a channel is / isn't available — drives gate copy consistently. */
  channelAccess: (channel: ChannelType) => ChannelAccess;
  refresh: () => void;

  // ── capabilities (migration 060) ──────────────────────────────────────────
  /** Everything the plan grants, resolved server-side (plan + studio overrides). */
  entitlements: ResolvedEntitlements | null;
  /** Public capability registry — labels for gates and plan feature lists. */
  capabilities: PlanCapability[];
  /** Granted? Booleans directly; a limit counts as granted unless capped at 0. */
  can: (key: CapabilityKey) => boolean;
  /** Numeric cap, or null for unlimited / not a limit. */
  limit: (key: CapabilityKey) => number | null;
  /** How much of a capped resource is already used. */
  usage: (key: CapabilityKey) => number;
  /** Headroom left, or null when unlimited. */
  remaining: (key: CapabilityKey) => number | null;
  /** Why a capability is / isn't available — the vocabulary gate copy uses. */
  access: (key: CapabilityKey) => CapabilityAccess;
  /** Admin-editable display name for a capability (falls back to the key). */
  capabilityLabel: (key: CapabilityKey) => string;
}

const EntitlementContext = createContext<EntitlementValue | null>(null);

/**
 * Fetches the active studio's subscription once and exposes a normalized
 * entitlement so every studio page (channels, bookings, dashboard, sidebar)
 * reads the SAME source of truth for "what does this plan allow". Lives inside
 * ActiveEntityProvider so it re-fetches when the selected/impersonated studio
 * changes.
 */
export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { entityId } = useActiveEntity();
  const [plan, setPlan] = useState<EntityPlan | null>(null);
  const [subscription, setSubscription] = useState<EntitySubscription | null>(null);
  const [entitlements, setEntitlements] = useState<ResolvedEntitlements | null>(null);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [capabilities, setCapabilities] = useState<PlanCapability[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!entityId) {
      setPlan(null);
      setSubscription(null);
      setEntitlements(null);
      setUsageCounts({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await entityPlansApi.getSubscription(entityId);
      setPlan(res.data.plan);
      setSubscription(res.data.subscription);
      setEntitlements(res.data.entitlements ?? null);
      setUsageCounts(res.data.usage ?? {});
      setCapabilities(res.data.capabilities ?? []);
    } catch (e) {
      console.error("Entitlement load failed:", e);
      setPlan(null);
      setSubscription(null);
      setEntitlements(null);
      setUsageCounts({});
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const value = useMemo<EntitlementValue>(() => {
    const allowedChannels = plan?.allowed_channel_types ?? [];

    const valueOf = (key: CapabilityKey) => entitlements?.values?.[key];

    const can = (key: CapabilityKey): boolean => {
      const v = valueOf(key);
      if (typeof v === "boolean") return v;
      if (v === null) return true; // unlimited
      if (typeof v === "number") return v > 0;
      // No entitlements payload yet (older API or still loading): fall back to
      // the channel column so channel gates never flash "locked".
      const channel = Object.entries(CHANNEL_CAPABILITY_BY_TYPE).find(([, k]) => k === key);
      return channel ? allowedChannels.includes(channel[0] as ChannelType) : false;
    };

    const limit = (key: CapabilityKey): number | null => {
      const v = valueOf(key);
      return typeof v === "number" ? v : null;
    };

    const usage = (key: CapabilityKey): number => usageCounts[key] ?? 0;

    const remaining = (key: CapabilityKey): number | null => {
      const cap = limit(key);
      return cap === null ? null : Math.max(0, cap - usage(key));
    };

    const access = (key: CapabilityKey): CapabilityAccess => {
      const hasPlan = entitlements?.hasActivePlan ?? !!plan;
      if (!hasPlan) return "no_subscription";
      const cap = limit(key);
      if (cap !== null && usage(key) >= cap) return "limit_reached";
      return can(key) ? "allowed" : "not_in_plan";
    };

    const capabilityLabel = (key: CapabilityKey): string =>
      capabilities.find((c) => c.key === key)?.label ?? key;

    // Channels are capabilities too — delegate so there is one implementation.
    const allows = (channel: ChannelType) => can(CHANNEL_CAPABILITY_BY_TYPE[channel]);
    const channelAccess = (channel: ChannelType): ChannelAccess => {
      const result = access(CHANNEL_CAPABILITY_BY_TYPE[channel]);
      // A channel has no cap, so "limit_reached" can't occur — narrow the type.
      return result === "limit_reached" ? "not_in_plan" : result;
    };

    return {
      loading,
      plan,
      subscription,
      hasActivePlan: !!plan,
      allowedChannels,
      allows,
      channelAccess,
      refresh: load,
      entitlements,
      capabilities,
      can,
      limit,
      usage,
      remaining,
      access,
      capabilityLabel,
    };
  }, [plan, subscription, loading, load, entitlements, usageCounts, capabilities]);

  return (
    <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>
  );
}

/** Active studio's plan entitlement. Must be used within EntitlementProvider. */
export function useEntitlement(): EntitlementValue {
  const ctx = useContext(EntitlementContext);
  if (!ctx) {
    throw new Error("useEntitlement must be used within EntitlementProvider");
  }
  return ctx;
}
