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

  getBookings: (entityId: string, params?: { page?: number; limit?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    return apiClient<PaginatedResponse<any>>(`/api/studio/${entityId}/bookings?${query}`);
  },

  checkinBooking: (entityId: string, bookingId: string) =>
    apiClient<{ success: boolean; data: any }>(`/api/studio/${entityId}/bookings/${bookingId}/checkin`, {
      method: "POST",
    }),

  updatePricing: (entityId: string, serviceId: string, pricing: { credit_price?: number }) =>
    apiClient<{ success: boolean; data: any }>(`/api/studio/${entityId}/services/${serviceId}/pricing`, {
      method: "PUT",
      body: JSON.stringify(pricing),
    }),

  getServices: (entityId: string) =>
    apiClient<{ success: boolean; data: any[] }>(`/api/studio/${entityId}/services`),

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
};
