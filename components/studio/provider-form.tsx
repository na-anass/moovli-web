"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StarIcon } from "lucide-react";

// ============================================================================
// Shared studio INSTRUCTOR (service_provider) form — single source of truth for
// the create/edit fields used by the Instructors dashboard and the onboarding
// wizard. Numeric inputs are kept as strings, converted in
// providerFormToPayload().
// ============================================================================

export interface ProviderFormValues {
  name: string;
  title: string;
  email: string;
  phone: string;
  tier: string;
  experience_years: string;
  base_rate: string;
  specializations: string; // comma-separated
  short_bio: string;
  bio: string;
  avatar_url: string;
  is_active: boolean;
  is_featured: boolean;
  display_order: string;
  instagram: string;
  facebook: string;
}

export const EMPTY_PROVIDER_FORM: ProviderFormValues = {
  name: "",
  title: "",
  email: "",
  phone: "",
  tier: "standard",
  experience_years: "",
  base_rate: "",
  specializations: "",
  short_bio: "",
  bio: "",
  avatar_url: "",
  is_active: true,
  is_featured: false,
  display_order: "0",
  instagram: "",
  facebook: "",
};

export function providerToForm(p: {
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  tier?: string | null;
  experience_years?: number | null;
  base_rate?: number | null;
  specializations?: string[] | null;
  short_bio?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  is_active?: boolean;
  is_featured?: boolean | null;
  display_order?: number | null;
  social_links?: Record<string, string> | null;
}): ProviderFormValues {
  return {
    name: p.name,
    title: p.title ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    tier: p.tier ?? "standard",
    experience_years: p.experience_years != null ? String(p.experience_years) : "",
    base_rate: p.base_rate != null ? String(p.base_rate) : "",
    specializations: (p.specializations ?? []).join(", "),
    short_bio: p.short_bio ?? "",
    bio: p.bio ?? "",
    avatar_url: p.avatar_url ?? "",
    is_active: p.is_active ?? true,
    is_featured: !!p.is_featured,
    display_order: String(p.display_order ?? 0),
    instagram: p.social_links?.instagram ?? "",
    facebook: p.social_links?.facebook ?? "",
  };
}

export function providerFormToPayload(form: ProviderFormValues) {
  const specializations = form.specializations
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const social: Record<string, string> = {};
  if (form.instagram.trim()) social.instagram = form.instagram.trim();
  if (form.facebook.trim()) social.facebook = form.facebook.trim();
  return {
    name: form.name.trim(),
    title: form.title.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    tier: form.tier,
    experience_years: form.experience_years ? parseInt(form.experience_years) : null,
    base_rate: form.base_rate ? parseFloat(form.base_rate) : null,
    specializations: specializations.length ? specializations : null,
    short_bio: form.short_bio.trim() || null,
    bio: form.bio.trim() || null,
    avatar_url: form.avatar_url.trim() || null,
    is_active: form.is_active,
    is_featured: form.is_featured,
    display_order: form.display_order ? parseInt(form.display_order) : 0,
    social_links: Object.keys(social).length ? social : null,
  };
}

export function isProviderFormValid(form: ProviderFormValues): boolean {
  return Boolean(form.name.trim());
}

export function ProviderForm({
  form,
  setForm,
  currency,
}: {
  form: ProviderFormValues;
  setForm: (next: ProviderFormValues) => void;
  currency: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Name *</label>
          <Input
            className="mt-1.5"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Instructor name"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Title</label>
          <Input
            className="mt-1.5"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Senior Pilates Coach"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Email</label>
          <Input
            className="mt-1.5"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@example.com"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Adding an email provisions an instructor login.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium">Phone</label>
          <Input
            className="mt-1.5"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+212…"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Experience (yrs)</label>
          <Input
            className="mt-1.5"
            type="number"
            min="0"
            value={form.experience_years}
            onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Rate ({currency})</label>
          <Input
            className="mt-1.5"
            type="number"
            min="0"
            step="0.01"
            value={form.base_rate}
            onChange={(e) => setForm({ ...form, base_rate: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Specializations</label>
        <Input
          className="mt-1.5"
          value={form.specializations}
          onChange={(e) => setForm({ ...form, specializations: e.target.value })}
          placeholder="Pilates, Yoga, HIIT (comma-separated)"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Short bio</label>
        <Input
          className="mt-1.5"
          value={form.short_bio}
          onChange={(e) => setForm({ ...form, short_bio: e.target.value })}
          placeholder="One-line summary"
          maxLength={500}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Bio</label>
        <textarea
          className="mt-1.5 min-h-[80px] w-full resize-y rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          placeholder="Detailed bio…"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Avatar URL</label>
        <Input
          className="mt-1.5"
          value={form.avatar_url}
          onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
          placeholder="https://…"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Instagram</label>
          <Input
            className="mt-1.5"
            value={form.instagram}
            onChange={(e) => setForm({ ...form, instagram: e.target.value })}
            placeholder="@handle or URL"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Facebook</label>
          <Input
            className="mt-1.5"
            value={form.facebook}
            onChange={(e) => setForm({ ...form, facebook: e.target.value })}
            placeholder="profile or URL"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 items-end gap-3">
        <div>
          <label className="text-sm font-medium">Display order</label>
          <Input
            className="mt-1.5"
            type="number"
            value={form.display_order}
            onChange={(e) => setForm({ ...form, display_order: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch
            checked={form.is_featured}
            onCheckedChange={(v) => setForm({ ...form, is_featured: v })}
          />
          <label className="flex items-center gap-1 text-sm font-medium">
            <StarIcon className="size-3" /> Featured
          </label>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch
            checked={form.is_active}
            onCheckedChange={(v) => setForm({ ...form, is_active: v })}
          />
          <label className="text-sm font-medium">Active</label>
        </div>
      </div>
    </div>
  );
}
