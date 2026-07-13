"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { InfoTip } from "@/components/ui/info-tip";
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
  const t = useTranslations("studioSettings.serviceForm");
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium inline-flex items-center gap-1">
          {t("name")}
          <InfoTip term="service" />
        </label>
        <Input
          className="mt-1.5"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={t("namePlaceholder")}
        />
      </div>

      <div>
        <label className="text-sm font-medium">{t("category")}</label>
        <Select
          value={form.category_id || "none"}
          onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder={t("categoryPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("uncategorized")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {t("categoryHint")}
        </p>
      </div>

      <div>
        <label className="text-sm font-medium">{t("shortDescription")}</label>
        <Input
          className="mt-1.5"
          value={form.short_description}
          onChange={(e) => setForm({ ...form, short_description: e.target.value })}
          placeholder={t("shortDescriptionPlaceholder")}
          maxLength={500}
        />
      </div>

      <div>
        <label className="text-sm font-medium">{t("description")}</label>
        <textarea
          className="mt-1.5 min-h-[80px] w-full resize-y rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder={t("descriptionPlaceholder")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1 text-sm font-medium">
            <ClockIcon className="size-3" /> {t("duration")}
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
            <UsersIcon className="size-3" /> {t("capacity")}
            <InfoTip term="capacity" />
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
          <label className="text-sm font-medium">{t("price", { currency })}</label>
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
              <StarIcon className="size-3" /> {t("featured")}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
