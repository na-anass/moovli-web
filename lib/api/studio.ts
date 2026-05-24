import { apiClient } from "./client";
import type { PaginatedResponse } from "./admin";

export interface StudioDashboardMetrics {
  bookingsThisWeek: number;
  bookingsLastWeek: number;
  uniqueMembers: number;
  activeSessions: number;
}

export interface EntityMembership {
  entityId: string;
  role: string;
  isPrimary: boolean;
  entity: {
    id: string;
    name: string;
    slug: string;
    city: string;
    logo_url: string | null;
    status: string;
  };
}

export const studioApi = {
  getMyEntities: () =>
    apiClient<{ success: boolean; data: EntityMembership[] }>("/api/studio/me"),

  getDashboard: (entityId: string) =>
    apiClient<{ success: boolean; data: StudioDashboardMetrics }>(
      `/api/studio/${entityId}/dashboard`
    ),

  getSessions: (entityId: string, params?: { page?: number; limit?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    return apiClient<PaginatedResponse<any>>(`/api/studio/${entityId}/sessions?${query}`);
  },

  createSession: (entityId: string, data: Record<string, any>) =>
    apiClient<{ success: boolean; data: any }>(`/api/studio/${entityId}/sessions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateSession: (entityId: string, sessionId: string, data: Record<string, any>) =>
    apiClient<{ success: boolean; data: any }>(`/api/studio/${entityId}/sessions/${sessionId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteSession: (entityId: string, sessionId: string) =>
    apiClient<{ success: boolean }>(`/api/studio/${entityId}/sessions/${sessionId}`, {
      method: "DELETE",
    }),

  getBookings: (
    entityId: string,
    params?: {
      page?: number;
      limit?: number;
      status?: string;
      channel_type?: string;
      channel_id?: string;
    },
  ) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.channel_type) query.set("channel_type", params.channel_type);
    if (params?.channel_id) query.set("channel_id", params.channel_id);
    return apiClient<PaginatedResponse<StudioBookingRow>>(`/api/studio/${entityId}/bookings?${query}`);
  },

  checkinBooking: (entityId: string, bookingId: string) =>
    apiClient<{ success: boolean; data: any }>(`/api/studio/${entityId}/bookings/${bookingId}/checkin`, {
      method: "POST",
    }),

  // Spec C — direct-channel confirmation flow
  confirmBooking: (entityId: string, bookingId: string) =>
    apiClient<{ success: boolean; data: StudioBookingRow }>(
      `/api/studio/${entityId}/bookings/${bookingId}/confirm`,
      { method: "POST" },
    ),

  declineBooking: (entityId: string, bookingId: string, reason?: string) =>
    apiClient<{ success: boolean; data: StudioBookingRow }>(
      `/api/studio/${entityId}/bookings/${bookingId}/decline`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),

  updatePricing: (entityId: string, serviceId: string, pricing: { credit_price?: number }) =>
    apiClient<{ success: boolean; data: any }>(`/api/studio/${entityId}/services/${serviceId}/pricing`, {
      method: "PUT",
      body: JSON.stringify(pricing),
    }),

  getServices: (entityId: string, all?: boolean) =>
    apiClient<{ success: boolean; data: any[] }>(`/api/studio/${entityId}/services${all ? "?all=true" : ""}`),

  createService: (entityId: string, data: Record<string, any>) =>
    apiClient<{ success: boolean; data: any }>(`/api/studio/${entityId}/services`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateService: (entityId: string, serviceId: string, data: Record<string, any>) =>
    apiClient<{ success: boolean; data: any }>(`/api/studio/${entityId}/services/${serviceId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getProfile: (entityId: string) =>
    apiClient<{ success: boolean; data: any }>(`/api/studio/${entityId}/profile`),

  updateProfile: (entityId: string, data: Record<string, any>) =>
    apiClient<{ success: boolean; data: any }>(`/api/studio/${entityId}/profile`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getProviders: (entityId: string) =>
    apiClient<{ success: boolean; data: any[] }>(`/api/studio/${entityId}/providers`),

  inviteProvider: (entityId: string, data: { name: string; email?: string }) =>
    apiClient<{ success: boolean; data: any }>(`/api/studio/${entityId}/providers/invite`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getInsights: (entityId: string, days: number = 30) =>
    apiClient<{ success: boolean; data: any }>(`/api/studio/${entityId}/insights?days=${days}`),

  searchUsers: (entityId: string, email: string) =>
    apiClient<{ success: boolean; data: { id: string; name: string; email: string; avatar_url: string | null; city: string | null }[] }>(
      `/api/studio/${entityId}/search-users?email=${encodeURIComponent(email)}`
    ),

  getTeam: (entityId: string) =>
    apiClient<{ success: boolean; data: any[] }>(`/api/studio/${entityId}/team`),

  addTeamMember: (entityId: string, userId: string, role: string) =>
    apiClient<{ success: boolean; data: any }>(`/api/studio/${entityId}/team`, {
      method: "POST",
      body: JSON.stringify({ userId, role }),
    }),

  updateTeamMemberRole: (entityId: string, userId: string, role: string) =>
    apiClient<{ success: boolean; data: any }>(`/api/studio/${entityId}/team/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),

  removeTeamMember: (entityId: string, userId: string) =>
    apiClient<{ success: boolean }>(`/api/studio/${entityId}/team/${userId}`, {
      method: "DELETE",
    }),

  // ==========================================================================
  // CUSTOMERS (CRM) — Spec C
  // ==========================================================================

  listCustomers: (
    entityId: string,
    params?: {
      search?: string;
      channelId?: string;
      acquisitionSource?: string;
      sortBy?: "last_booking_at" | "lifetime_value_mad" | "total_bookings" | "created_at";
      sortOrder?: "asc" | "desc";
      limit?: number;
      offset?: number;
    },
  ) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.channelId) q.set("channelId", params.channelId);
    if (params?.acquisitionSource) q.set("acquisitionSource", params.acquisitionSource);
    if (params?.sortBy) q.set("sortBy", params.sortBy);
    if (params?.sortOrder) q.set("sortOrder", params.sortOrder);
    if (params?.limit != null) q.set("limit", String(params.limit));
    if (params?.offset != null) q.set("offset", String(params.offset));
    return apiClient<{ success: boolean; data: EntityCustomer[]; total: number }>(
      `/api/studio/${entityId}/customers?${q}`,
    );
  },

  getCustomer: (entityId: string, customerId: string) =>
    apiClient<{ success: boolean; data: EntityCustomer }>(
      `/api/studio/${entityId}/customers/${customerId}`,
    ),

  updateCustomer: (
    entityId: string,
    customerId: string,
    update: { notes?: string | null; tags?: string[]; marketing_email_consent?: boolean },
  ) =>
    apiClient<{ success: boolean; data: EntityCustomer }>(
      `/api/studio/${entityId}/customers/${customerId}`,
      { method: "PATCH", body: JSON.stringify(update) },
    ),

  // ==========================================================================
  // CHANNEL PREFERENCES (per-entity opt-out for channel types)
  // ==========================================================================

  getChannelPrefs: (entityId: string) =>
    apiClient<{ success: boolean; data: ChannelPrefs }>(
      `/api/studio/${entityId}/channel-prefs`,
    ),

  updateChannelPrefs: (entityId: string, prefs: Partial<ChannelPrefs>) =>
    apiClient<{ success: boolean; data: ChannelPrefs }>(
      `/api/studio/${entityId}/channel-prefs`,
      { method: "PATCH", body: JSON.stringify(prefs) },
    ),

  // Spec C — branding
  getBranding: (entityId: string) =>
    apiClient<{ success: boolean; data: { primary_color: string | null } }>(
      `/api/studio/${entityId}/branding`,
    ),

  updateBranding: (entityId: string, primary_color: string | null) =>
    apiClient<{ success: boolean; data: { primary_color: string | null } }>(
      `/api/studio/${entityId}/branding`,
      { method: "PATCH", body: JSON.stringify({ primary_color }) },
    ),

  // Spec D groundwork — payout method
  getPayoutMethod: (entityId: string) =>
    apiClient<{ success: boolean; data: EntityPayoutMethod | null }>(
      `/api/studio/${entityId}/payout-method`,
    ),

  updatePayoutMethod: (entityId: string, body: PayoutMethodInput) =>
    apiClient<{ success: boolean; data: EntityPayoutMethod }>(
      `/api/studio/${entityId}/payout-method`,
      { method: "PUT", body: JSON.stringify(body) },
    ),

  // Tier 2 — mark onboarding wizard complete (stamps entities.onboarded_at)
  completeOnboarding: (entityId: string) =>
    apiClient<{ success: boolean; data: { id: string; onboarded_at: string } }>(
      `/api/studio/${entityId}/onboarding/complete`,
      { method: "POST" },
    ),
};

export interface EntityPayoutMethod {
  id: string;
  entity_id: string;
  method_type: "bank_transfer";
  account_holder: string;
  iban: string | null;
  bank_name: string | null;
  swift_bic: string | null;
  provider_recipient_id: string | null;
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayoutMethodInput {
  account_holder: string;
  iban?: string;
  bank_name?: string;
  swift_bic?: string;
}

export interface ChannelPrefs {
  marketplace_enabled: boolean;
  direct_hosted_enabled: boolean;
  direct_link_enabled: boolean;
  direct_embed_enabled: boolean;
}

export interface StudioBookingRow {
  id: string;
  entity_id: string;
  service_id: string;
  session_id: string;
  channel_id: string | null;
  user_id: string | null;
  status: string;
  payment_type: string;
  booking_date: string | null;
  price_mad_at_booking: number | null;
  markup_pct_at_booking: number | null;
  credits_charged: number | null;
  guest_email: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  created_at: string;
  service: { id: string; name: string } | null;
  session: {
    start_time: string;
    end_time: string;
    provider: { name: string } | null;
  } | null;
  channel: { id: string; type: AcquisitionSource; label: string; slug: string } | null;
  user: { id: string; name: string | null; email: string } | null;
}

export type AcquisitionSource =
  | "marketplace"
  | "direct_hosted"
  | "direct_link"
  | "direct_embed"
  | "manual"
  | "unknown";

export interface EntityCustomer {
  id: string;
  entity_id: string;
  user_id: string | null;
  email: string;
  name: string;
  phone: string | null;
  first_seen_at: string;
  first_seen_via_channel_id: string | null;
  acquisition_source: AcquisitionSource;
  total_bookings: number;
  confirmed_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  no_shows: number;
  lifetime_value_mad: number;
  last_booking_at: string | null;
  notes: string | null;
  tags: string[];
  marketing_email_consent: boolean;
  created_at: string;
  updated_at: string;
}
