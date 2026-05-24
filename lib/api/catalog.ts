import { apiClient } from "./client";

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  display_order: number;
}

export const catalogApi = {
  listCategories: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    return apiClient<{ success: boolean; data: Category[]; pagination?: { total: number } }>(
      `/api/catalog/categories?${q}`,
    );
  },
};
