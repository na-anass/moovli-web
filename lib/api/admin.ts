import { apiClient } from "./client";

export interface DashboardMetrics {
  totalUsers: number;
  activeStudios: number;
  bookingsThisWeek: number;
  creditsThisMonth: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface EntityType {
  id: string;
  name: string;
  slug: string;
}

export type StudioTypeSlug =
  | "fitness_studio"
  | "yoga_studio"
  | "pilates_studio"
  | "dance_studio"
  | "boxing_gym"
  | "crossfit_box"
  | "beauty_salon"
  | "spa_wellness";

export interface ProvisionStudioInput {
  ownerEmail: string;
  ownerName?: string;
  ownerPhone?: string;
  studioName: string;
  studioTypeSlug: StudioTypeSlug;
  slug?: string;
  city?: string;
  country?: string;
  currencyCode?: string;
  contactEmail?: string;
  contactPhone?: string;
  credentialMode: "invite" | "temp_password";
  planSlug?: "standard" | "marketplace";
}

export interface ProvisionStudioResult {
  entityId: string;
  slug: string;
  ownerUserId: string;
  ownerAlreadyExisted: boolean;
  tempPassword?: string;
  subscriptionId: string;
}

export const adminApi = {
  getDashboard: () =>
    apiClient<{ success: boolean; data: DashboardMetrics }>("/api/admin/dashboard"),

  getUsers: (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.search) query.set("search", params.search);
    if (params?.status) query.set("status", params.status);
    return apiClient<PaginatedResponse<any>>(`/api/admin/users?${query}`);
  },

  getUserById: (id: string) =>
    apiClient<{ success: boolean; data: any }>(`/api/admin/users/${id}`),

  updateUserStatus: (id: string, status: "active" | "suspended") =>
    apiClient<{ success: boolean; data: any }>(`/api/admin/users/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  setUserAdmin: (id: string, isAdmin: boolean) =>
    apiClient<{ success: boolean; data: any }>(`/api/admin/users/${id}/admin`, {
      method: "PUT",
      body: JSON.stringify({ isAdmin }),
    }),

  adjustCredits: (id: string, credits: number, description: string) =>
    apiClient<{ success: boolean; data: any }>(`/api/admin/users/${id}/credit-adjustment`, {
      method: "POST",
      body: JSON.stringify({ credits, description }),
    }),

  getEntities: (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.search) query.set("search", params.search);
    if (params?.status) query.set("status", params.status);
    return apiClient<PaginatedResponse<any>>(`/api/admin/entities?${query}`);
  },

  updateEntity: (id: string, data: Record<string, any>) =>
    apiClient<{ success: boolean; data: any }>(`/api/admin/entities/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  createEntity: (data: Record<string, any>) =>
    apiClient<{ success: boolean; data: any }>("/api/admin/entities", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  assignOwner: (entityId: string, userId: string, role: string = "owner") =>
    apiClient<{ success: boolean; data: any }>(`/api/admin/entities/${entityId}/assign-owner`, {
      method: "POST",
      body: JSON.stringify({ userId, role }),
    }),

  getEntityTypes: () =>
    apiClient<{ success: boolean; data: EntityType[] }>("/api/admin/entity-types"),

  provisionStudio: (input: ProvisionStudioInput) =>
    apiClient<{ success: boolean; data: ProvisionStudioResult }>("/api/admin/studios/provision", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getBookings: (params?: { page?: number; limit?: number; status?: string; entity_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.entity_id) query.set("entity_id", params.entity_id);
    return apiClient<PaginatedResponse<any>>(`/api/admin/bookings?${query}`);
  },

  getInstructors: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    is_active?: boolean;
    entity_id?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.search) query.set("search", params.search);
    if (params?.is_active !== undefined) query.set("is_active", String(params.is_active));
    if (params?.entity_id) query.set("entity_id", params.entity_id);
    return apiClient<PaginatedResponse<any>>(`/api/admin/instructors?${query}`);
  },

  getAnalyticsOverview: () =>
    apiClient<{ success: boolean; data: any }>("/api/admin/analytics/overview"),

  getAnalyticsTrends: (days: number = 30) =>
    apiClient<{ success: boolean; data: any[] }>(`/api/admin/analytics/trends?days=${days}`),

  getTopStudios: (limit: number = 10) =>
    apiClient<{ success: boolean; data: any[] }>(`/api/admin/analytics/top-studios?limit=${limit}`),
};
