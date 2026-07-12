"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ClockIcon, StarIcon, UsersIcon } from "lucide-react";
import type { Category } from "@/lib/api/catalog";

// ============================================================================
// Shared studio SERVICE form — single source of truth for the create/edit
// fields used by the Services dashboard and the onboarding wizard, so neither
// can drift or miss a field. Numeric inputs are kept as strings (matching the
// dashboard), converted to numbers in serviceFormToPayload().
// ============================================================================

export interface ServiceFormValues {
  name: string;
  description: string;
  short_description: string;
  base_price: string;
  duration_minutes: string;
  capacity: string;
  is_featured: boolean;
  category_id: string;
}

export const EMPTY_SERVICE_FORM: ServiceFormValues = {
  name: "",
  description: "",
  short_description: "",
  base_price: "",
  duration_minutes: "60",
  capacity: "10",
  is_featured: false,
  category_id: "",
};

/** Raw service shape (a subset of the API service object) → editable form. */
export function serviceToForm(s: {
  name: string;
  description?: string | null;
  short_description?: string | null;
  base_price: number | string;
  duration_minutes: number;
  capacity: number;
  is_featured?: boolean;
  category_id?: string | null;
}): ServiceFormValues {
  return {
    name: s.name,
    description: s.description ?? "",
    short_description: s.short_description ?? "",
    base_price: String(s.base_price),
    duration_minutes: String(s.duration_minutes),
    capacity: String(s.capacity),
    is_featured: !!s.is_featured,
    category_id: s.category_id ?? "",
  };
}

export function serviceFormToPayload(form: ServiceFormValues) {
  return {
    name: form.name.trim(),
    description: form.description || null,
    short_description: form.short_description || null,
    base_price: parseFloat(form.base_price) || 0,
    duration_minutes: parseInt(form.duration_minutes) || 60,
    capacity: parseInt(form.capacity) || 10,
    is_featured: form.is_featured,
    category_id: form.category_id || null,
  };
}

export function isServiceFormValid(form: ServiceFormValues): boolean {
  return Boolean(
    form.name.trim() && form.duration_minutes && form.capacity && form.base_price,
  );
}

export function ServiceForm({
  form,
  setForm,
  categories,
  currency,
}: {
  form: ServiceFormValues;
  setForm: (next: ServiceFormValues) => void;
  categories: Category[];
  currency: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Name *</label>
        <Input
          className="mt-1.5"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Megaformer Pilates"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Category</label>
        <Select
          value={form.category_id || "none"}
          onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Pick a category…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Uncategorized</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Helps consumers discover your service by type (yoga, HIIT, spa…).
        </p>
      </div>

      <div>
        <label className="text-sm font-medium">Short description</label>
        <Input
          className="mt-1.5"
          value={form.short_description}
          onChange={(e) => setForm({ ...form, short_description: e.target.value })}
          placeholder="One-line summary"
          maxLength={500}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea
          className="mt-1.5 min-h-[80px] w-full resize-y rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Detailed description…"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1 text-sm font-medium">
            <ClockIcon className="size-3" /> Duration (min) *
          </label>
          <Input
            type="number"
            className="mt-1.5"
            value={form.duration_minutes}
            min="5"
            onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
          />
        </div>
        <div>
          <label className="flex items-center gap-1 text-sm font-medium">
            <UsersIcon className="size-3" /> Capacity *
          </label>
          <Input
            type="number"
            className="mt-1.5"
            value={form.capacity}
            min="1"
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Price ({currency}) *</label>
          <Input
            type="number"
            className="mt-1.5"
            value={form.base_price}
            min="0"
            step="0.01"
            onChange={(e) => setForm({ ...form, base_price: e.target.value })}
          />
        </div>
        <div className="flex items-end pb-1">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.is_featured}
              onCheckedChange={(v) => setForm({ ...form, is_featured: v })}
            />
            <label className="flex items-center gap-1 text-sm font-medium">
              <StarIcon className="size-3" /> Featured
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
