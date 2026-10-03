import { apiClient } from "./client";
import type { ChannelType, EntityPlan } from "./entityPlans";
import type { CapabilityKey, CapabilityKind } from "@/lib/entitlements/capabilities";

/** A plan row plus how many studios are on it — the editor warns before a change bites. */
export interface AdminPlan extends EntityPlan {
  subscriber_count: number;
}

export interface AdminPlanDetail extends AdminPlan {
  prices: PlanPrice[];
}

export interface PlanPrice {
  id: string;
  plan_id: string;
  stripe_price_id: string;
  amount_mad: number;
  label: string | null;
  is_primary: boolean;
  created_at: string;
}

/** Registry row as the admin sees it — includes internal (is_public = false) rows. */
export interface AdminCapability {
  key: CapabilityKey;
  kind: CapabilityKind;
  category: string;
  label: string;
  description: string | null;
  default_value: boolean | number | null;
  is_public: boolean;
  sort_order: number;
}

export interface PlanRevision {
  id: string;
  snapshot: Record<string, unknown>;
  changed_by: string | null;
  changed_at: string;
}

export type PlanPatch = Partial<{
  name: string;
  description: string | null;
  price_mad: number;
  billing_interval: "month" | "year";
  allowed_channel_types: ChannelType[];
  entitlements: Record<string, boolean | number | null>;
  is_active: boolean;
  is_self_serve: boolean;
  is_default_signup: boolean;
  downgrade_plan_id: string | null;
  sort_order: number;
}>;

const BASE = "/api/admin/entity-plans";

export const adminPlansApi = {
  list: () => apiClient<{ success: boolean; data: AdminPlan[] }>(BASE),

  get: (planId: string) =>
    apiClient<{ success: boolean; data: AdminPlanDetail }>(`${BASE}/${planId}`),

  capabilities: () =>
    apiClient<{ success: boolean; data: AdminCapability[] }>(`${BASE}/capabilities`),

  create: (body: PlanPatch & { slug: string; name: string; price_mad: number; cloneFromPlanId?: string }) =>
    apiClient<{ success: boolean; data: AdminPlan }>(BASE, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** `stripe_sync_required` comes back true when the price changed. */
  update: (planId: string, patch: PlanPatch) =>
    apiClient<{ success: boolean; data: AdminPlan; stripe_sync_required: boolean }>(
      `${BASE}/${planId}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    ),

  revisions: (planId: string) =>
    apiClient<{ success: boolean; data: PlanRevision[] }>(`${BASE}/${planId}/revisions`),

  prices: (planId: string) =>
    apiClient<{ success: boolean; data: PlanPrice[] }>(`${BASE}/${planId}/prices`),

  /** Creates the Stripe Product/Price for the plan's current amount. */
  stripeSync: (planId: string, body: { label?: string; makePrimary?: boolean; amountMad?: number } = {}) =>
    apiClient<{
      success: boolean;
      data: { productId: string; priceId: string; createdProduct: boolean; createdPrice: boolean };
    }>(`${BASE}/${planId}/stripe-sync`, { method: "POST", body: JSON.stringify(body) }),

  entityEntitlements: (entityId: string) =>
    apiClient<{
      success: boolean;
      data: {
        resolved: { values: Record<string, boolean | number | null>; source: Record<string, string> };
        overrides: Record<string, boolean | number | null>;
      };
    }>(`${BASE}/studios/${entityId}/entitlements`),

  setEntityOverrides: (entityId: string, overrides: Record<string, boolean | number | null>) =>
    apiClient<{ success: boolean }>(`${BASE}/studios/${entityId}/entitlements`, {
      method: "PATCH",
      body: JSON.stringify({ overrides }),
    }),
};
