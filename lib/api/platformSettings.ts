// ============================================================================
// PLATFORM SETTINGS API CLIENT
// Path: lib/api/platformSettings.ts
//
// Admin-only operations against /api/admin/settings plus the unauthenticated
// /api/platform-settings/public bootstrap.
// ============================================================================

import { apiClient } from "./client";

export type SettingDataType = "number" | "string" | "boolean" | "json";

export interface PlatformSetting {
  key: string;
  value: unknown;
  category: string;
  label: string;
  description: string | null;
  data_type: SettingDataType;
  is_public: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface PublicPlatformSetting {
  key: string;
  value: unknown;
  data_type: SettingDataType;
  label: string;
  description: string | null;
}

export const platformSettingsApi = {
  /** Admin — list every setting, optionally filtered by category. */
  list: (params?: { category?: string }) => {
    const q = new URLSearchParams();
    if (params?.category) q.set("category", params.category);
    const qs = q.toString();
    return apiClient<{ success: boolean; data: PlatformSetting[] }>(
      `/api/admin/settings${qs ? `?${qs}` : ""}`,
    );
  },

  /** Admin — fetch a single setting by key. */
  get: (key: string) =>
    apiClient<{ success: boolean; data: PlatformSetting }>(
      `/api/admin/settings/${encodeURIComponent(key)}`,
    ),

  /** Admin — update a setting's value. Accepts any JSON-serializable value. */
  update: (key: string, value: unknown) =>
    apiClient<{ success: boolean; data: PlatformSetting }>(
      `/api/admin/settings/${encodeURIComponent(key)}`,
      { method: "PATCH", body: JSON.stringify({ value }) },
    ),

  /** Public — list every is_public=TRUE setting. No auth required. */
  listPublic: () =>
    apiClient<{ success: boolean; data: PublicPlatformSetting[] }>(
      "/api/platform-settings/public",
    ),
};
