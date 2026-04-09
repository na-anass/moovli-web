import { apiClient } from "./client";
import type { PaginatedResponse } from "./admin";

export const instructorApi = {
  getMyProfile: () =>
    apiClient<{ success: boolean; data: any[] }>("/api/instructor/me"),

  updateProfile: (data: { bio?: string; short_bio?: string; specializations?: string[]; avatar_url?: string }) =>
    apiClient<{ success: boolean; data: any }>("/api/instructor/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getSessions: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    return apiClient<PaginatedResponse<any>>(`/api/instructor/sessions?${query}`);
  },

  getSessionAttendees: (sessionId: string) =>
    apiClient<{ success: boolean; data: any[] }>(`/api/instructor/sessions/${sessionId}/attendees`),

  checkinAttendee: (sessionId: string, bookingId: string) =>
    apiClient<{ success: boolean; data: any }>(`/api/instructor/sessions/${sessionId}/checkin/${bookingId}`, {
      method: "POST",
    }),

  getSchedule: (dateFrom?: string, dateTo?: string) => {
    const query = new URLSearchParams();
    if (dateFrom) query.set("date_from", dateFrom);
    if (dateTo) query.set("date_to", dateTo);
    return apiClient<{ success: boolean; data: any[] }>(`/api/instructor/schedule?${query}`);
  },
};
