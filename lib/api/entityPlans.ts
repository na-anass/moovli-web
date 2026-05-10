import { apiClient } from "./client";

export type ChannelType =
  | "marketplace"
  | "direct_hosted"
  | "direct_link"
  | "direct_embed";

export interface EntityPlan {
  id: string;
  slug: "standard" | "marketplace";
  name: string;
  description: string | null;
  price_mad: number;
  billing_interval: "month" | "year";
  allowed_channel_types: ChannelType[];
  base_markup_pct: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  is_active: boolean;
  sort_order: number;
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
    planSlug: "standard" | "marketplace";
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
