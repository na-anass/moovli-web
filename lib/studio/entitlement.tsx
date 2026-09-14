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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!entityId) {
      setPlan(null);
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await entityPlansApi.getSubscription(entityId);
      setPlan(res.data.plan);
      setSubscription(res.data.subscription);
    } catch (e) {
      console.error("Entitlement load failed:", e);
      setPlan(null);
      setSubscription(null);
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
    const allows = (channel: ChannelType) => allowedChannels.includes(channel);
    const channelAccess = (channel: ChannelType): ChannelAccess => {
      if (allows(channel)) return "allowed";
      return plan ? "not_in_plan" : "no_subscription";
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
    };
  }, [plan, subscription, loading, load]);

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
