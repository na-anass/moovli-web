// ============================================================================
// Plan capability keys (mirror of moovli-api/src/config/entitlements.ts)
// ----------------------------------------------------------------------------
// Duplicated deliberately: the two repos share no workspace, and this is the
// existing convention (ChannelType is duplicated the same way). The API script
// `scripts/check-capability-parity.ts` fails if the two lists drift.
//
// Only KEYS and KINDS live here. Labels and descriptions come from the API
// (the plan_capabilities registry), so admin-edited copy wins without a deploy.
// ============================================================================

export const CAPABILITY_KEYS = [
  "channel.marketplace",
  "channel.direct_hosted",
  "channel.direct_link",
  "channel.direct_embed",
  "feature.insights.advanced",
  "feature.customers.export",
  "limit.team_members",
  "limit.instructors",
  "limit.services",
  "limit.sessions_per_month",
  "commission.marketplace_floor_pct",
  "pricing.tier_delta_pct",
] as const;

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

export type CapabilityKind = "channel" | "boolean" | "limit" | "percent";

export type CapabilityValue = boolean | number | null;

/** A row of the API's public capability registry. */
export interface PlanCapability {
  key: CapabilityKey;
  kind: CapabilityKind;
  category: string;
  label: string;
  description: string | null;
  sort_order: number;
}

export type CapabilitySource = "plan" | "override" | "default";

/** What the API resolves for the active studio. */
export interface ResolvedEntitlements {
  planId: string | null;
  planSlug: string | null;
  planName: string | null;
  hasActivePlan: boolean;
  values: Record<CapabilityKey, CapabilityValue>;
  source: Record<CapabilityKey, CapabilitySource>;
}

/**
 * Why a capability is or isn't available. Extends the channel vocabulary the
 * studio UI already shares with /studio/billing, so gate copy stays consistent.
 */
export type CapabilityAccess =
  | "allowed"
  | "not_in_plan"
  | "limit_reached"
  | "no_subscription";

import type { ChannelType } from "@/lib/api/entityPlans";

export const CHANNEL_CAPABILITY_BY_TYPE: Record<ChannelType, CapabilityKey> = {
  marketplace: "channel.marketplace",
  direct_hosted: "channel.direct_hosted",
  direct_link: "channel.direct_link",
  direct_embed: "channel.direct_embed",
};
