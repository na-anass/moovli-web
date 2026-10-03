import { apiClient } from "./client";
import type {
  PlanCapability,
  ResolvedEntitlements,
} from "@/lib/entitlements/capabilities";

export type ChannelType =
  | "marketplace"
  | "direct_hosted"
  | "direct_link"
  | "direct_embed";

export interface EntityPlan {
  id: string;
  /** Plan slugs are data — a new plan must not require a frontend deploy. */
  slug: string;
  name: string;
  description: string | null;
  price_mad: number;
  billing_interval: "month" | "year";
  allowed_channel_types: ChannelType[];
  /** @deprecated superseded by the commission.marketplace_floor_pct entitlement. */
  base_markup_pct: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  is_active: boolean;
  sort_order: number;
  /** Capability key → value (channels excluded — allowed_channel_types owns those). */
  entitlements: Record<string, boolean | number | null>;
  /** Whether the plan shows in the public catalog. */
  is_self_serve: boolean;
  /** The plan new studios are provisioned onto. */
  is_default_signup: boolean;
  /** Where a lapsed card-less trial lands; null = cancel. */
  downgrade_plan_id: string | null;
}

export type EntitySubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled"
  | "paused";

export interface EntitySubscription {
  id: string;
  entity_id: string;
  plan_id: string;
  status: EntitySubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  payment_attempt_count?: number;
  last_payment_failure_at?: string | null;
}

export interface EntityInvoice {
  id: string;
  stripe_invoice_id: string;
  amount_mad: number;
  currency: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  created_at: string;
}

interface SubscriptionResponse {
  subscription: EntitySubscription | null;
  plan: EntityPlan | null;
  invoices: EntityInvoice[];
  /** Resolved capabilities (plan + per-studio overrides). */
  entitlements: ResolvedEntitlements;
  /** Usage counts for capped capabilities, so meters need no extra request. */
  usage: Record<string, number>;
  /** Public capability registry — admin-editable labels for gates and plan cards. */
  capabilities: PlanCapability[];
}

export const entityPlansApi = {
  listPlans: () =>
    apiClient<{ success: boolean; data: EntityPlan[] }>("/api/entity-plans"),

  getSubscription: (entityId: string) =>
    apiClient<{ success: boolean; data: SubscriptionResponse }>(
      `/api/entity-plans/subscription/${entityId}`,
    ),

  createCheckoutSession: (params: {
    entityId: string;
    planSlug: string;
    successUrl: string;
    cancelUrl: string;
  }) =>
    apiClient<{ success: boolean; data: { url: string; sessionId: string } }>(
      "/api/entity-plans/checkout-session",
      { method: "POST", body: JSON.stringify(params) },
    ),

  createPortalSession: (params: { entityId: string; returnUrl: string }) =>
    apiClient<{ success: boolean; data: { url: string } }>(
      "/api/entity-plans/portal-session",
      { method: "POST", body: JSON.stringify(params) },
    ),

  cancel: (entityId: string) =>
    apiClient<{ success: boolean; data: EntitySubscription }>(
      "/api/entity-plans/cancel",
      { method: "POST", body: JSON.stringify({ entityId }) },
    ),
};
