import { apiClient } from "./client";

export type ChannelType = "marketplace" | "direct_hosted" | "direct_link" | "direct_embed";

export interface Channel {
  id: string;
  entity_id: string | null;
  type: ChannelType;
  slug: string;
  label: string;
  is_default: boolean;
  filters: Record<string, unknown>;
  settings: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateChannelInput {
  entityId: string;
  type: Exclude<ChannelType, "marketplace">;
  slug: string;
  label: string;
  filters?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface UpdateChannelInput {
  label?: string;
  slug?: string;
  filters?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  isActive?: boolean;
}

export const channelsApi = {
  listForEntity: (entityId: string) =>
    apiClient<{ success: boolean; data: Channel[] }>(
      `/api/channels/entity/${entityId}`,
    ),

  getById: (channelId: string) =>
    apiClient<{ success: boolean; data: Channel }>(`/api/channels/${channelId}`),

  create: (input: CreateChannelInput) =>
    apiClient<{ success: boolean; data: Channel }>("/api/channels", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  update: (channelId: string, input: UpdateChannelInput) =>
    apiClient<{ success: boolean; data: Channel }>(`/api/channels/${channelId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  delete: (channelId: string) =>
    apiClient<void>(`/api/channels/${channelId}`, { method: "DELETE" }),

  sessionsByChannel: (
    channelId: string,
    params?: { startAfter?: string; startBefore?: string; serviceId?: string; limit?: number },
  ) => {
    const q = new URLSearchParams();
    if (params?.startAfter) q.set("startAfter", params.startAfter);
    if (params?.startBefore) q.set("startBefore", params.startBefore);
    if (params?.serviceId) q.set("serviceId", params.serviceId);
    if (params?.limit) q.set("limit", String(params.limit));
    return apiClient<{ success: boolean; data: unknown[] }>(
      `/api/channels/${channelId}/sessions?${q}`,
    );
  },
};
