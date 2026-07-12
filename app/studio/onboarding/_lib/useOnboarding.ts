"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { studioApi, type EntityPolicies } from "@/lib/api/studio";
import { catalogApi, type Category } from "@/lib/api/catalog";
import {
  entityPlansApi,
  type EntityPlan,
} from "@/lib/api/entityPlans";
import { channelsApi, type Channel } from "@/lib/api/channels";

// ============================================================================
// Onboarding data hook
// ----------------------------------------------------------------------------
// Loads everything the wizard needs once, and keeps live copies in state.
// Every panel persists directly through studioApi (records are real the moment
// they're saved), then updates the matching list here — so leaving and coming
// back (including the Stripe checkout round-trip) rehydrates with everything in
// place. `onboarded_at` is only stamped at Finish.
// ============================================================================

export interface ProfileState {
  name: string;
  city: string;
  short_description: string;
  logo_url: string;
  /** entities.slug — informational; the public booking URL uses the channel slug. */
  slug: string;
}

// Rich enough to round-trip through the shared studio ServiceForm without
// losing fields (description, featured, category…).
export interface ServiceRow {
  id: string;
  name: string;
  category_id: string | null;
  duration_minutes: number;
  capacity: number;
  base_price: number;
  description: string | null;
  short_description: string | null;
  is_featured: boolean;
}

// Rich enough to round-trip through the shared studio ProviderForm.
export interface ProviderRow {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  tier: string | null;
  experience_years: number | null;
  base_rate: number | null;
  specializations: string[] | null;
  short_bio: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  display_order: number | null;
  social_links: Record<string, string> | null;
}

export interface ExistingSession {
  id: string;
  service_id: string | null;
  provider_id: string | null;
  start_time: string;
  end_time: string;
  capacity: number;
  price_mad: number;
}

export const DEFAULT_COLOR = "#7c3aed";

const EMPTY_PROFILE: ProfileState = {
  name: "",
  city: "",
  short_description: "",
  logo_url: "",
  slug: "",
};

const DEFAULT_POLICIES: EntityPolicies = {
  cancellation_free_hours: 24,
  booking_cutoff_minutes: 120,
};

export interface OnboardingData {
  loading: boolean;
  entityId: string;
  currency: string;

  profile: ProfileState;
  setProfile: (patch: Partial<ProfileState>) => void;

  color: string;
  setColor: (c: string) => void;

  policies: EntityPolicies;
  setPolicies: (patch: Partial<EntityPolicies>) => void;

  services: ServiceRow[];
  setServices: React.Dispatch<React.SetStateAction<ServiceRow[]>>;

  providers: ProviderRow[];
  setProviders: React.Dispatch<React.SetStateAction<ProviderRow[]>>;

  categories: Category[];

  plans: EntityPlan[];
  currentPlanSlug: string | null;
  refreshSubscription: () => Promise<void>;

  /** direct_hosted channel — powers the public booking URL /booking/{slug}. */
  channel: { id: string; slug: string } | null;
  setChannelSlug: (slug: string) => void;

  existingSessions: ExistingSession[];

  saved: boolean;
  flashSaved: () => void;
}

export function useOnboarding(entityId: string, currency: string): OnboardingData {
  const [loading, setLoading] = useState(true);
  const [profile, setProfileState] = useState<ProfileState>(EMPTY_PROFILE);
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [policies, setPoliciesState] = useState<EntityPolicies>(DEFAULT_POLICIES);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [plans, setPlans] = useState<EntityPlan[]>([]);
  const [currentPlanSlug, setCurrentPlanSlug] = useState<string | null>(null);
  const [channel, setChannel] = useState<{ id: string; slug: string } | null>(null);
  const [existingSessions, setExistingSessions] = useState<ExistingSession[]>([]);
  const [saved, setSaved] = useState(false);

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setProfile = useCallback((patch: Partial<ProfileState>) => {
    setProfileState((p) => ({ ...p, ...patch }));
  }, []);

  const setPolicies = useCallback((patch: Partial<EntityPolicies>) => {
    setPoliciesState((p) => ({ ...p, ...patch }));
  }, []);

  const setChannelSlug = useCallback((slug: string) => {
    setChannel((c) => (c ? { ...c, slug } : c));
  }, []);

  const flashSaved = useCallback(() => {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
  }, []);

  const refreshSubscription = useCallback(async () => {
    if (!entityId) return;
    try {
      const sub = await entityPlansApi.getSubscription(entityId);
      setCurrentPlanSlug(sub.data.plan?.slug ?? null);
    } catch (e) {
      console.error(e);
    }
  }, [entityId]);

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const pickDirectHosted = (list: Channel[]) =>
        list.find((c) => c.type === "direct_hosted") ?? null;

      const [
        profileRes,
        brandRes,
        policiesRes,
        servicesRes,
        providersRes,
        categoriesRes,
        plansRes,
        subRes,
        channelsRes,
        sessionsRes,
      ] = await Promise.allSettled([
        studioApi.getProfile(entityId),
        studioApi.getBranding(entityId),
        studioApi.getPolicies(entityId),
        studioApi.getServices(entityId, true),
        studioApi.getProviders(entityId, true),
        catalogApi.listCategories({ limit: 50 }),
        entityPlansApi.listPlans(),
        entityPlansApi.getSubscription(entityId),
        channelsApi.listForEntity(entityId),
        studioApi.getSessions(entityId, { limit: 100, lifecycle_status: "draft" }),
      ]);

      if (cancelled) return;

      if (profileRes.status === "fulfilled") {
        const e = profileRes.value.data ?? {};
        setProfileState({
          name: e.name ?? "",
          city: e.city ?? "",
          short_description: e.short_description ?? "",
          logo_url: e.logo_url ?? "",
          slug: e.slug ?? "",
        });
      }
      if (brandRes.status === "fulfilled" && brandRes.value.data.primary_color) {
        setColor(brandRes.value.data.primary_color);
      }
      if (policiesRes.status === "fulfilled" && policiesRes.value.data) {
        setPoliciesState({
          cancellation_free_hours:
            policiesRes.value.data.cancellation_free_hours ??
            DEFAULT_POLICIES.cancellation_free_hours,
          booking_cutoff_minutes:
            policiesRes.value.data.booking_cutoff_minutes ??
            DEFAULT_POLICIES.booking_cutoff_minutes,
        });
      }
      if (servicesRes.status === "fulfilled") {
        setServices((servicesRes.value.data ?? []).map(toServiceRow));
      }
      if (providersRes.status === "fulfilled") {
        setProviders((providersRes.value.data ?? []).map(toProviderRow));
      }
      if (categoriesRes.status === "fulfilled") {
        setCategories(categoriesRes.value.data ?? []);
      }
      if (plansRes.status === "fulfilled") {
        setPlans(plansRes.value.data ?? []);
      }
      if (subRes.status === "fulfilled") {
        setCurrentPlanSlug(subRes.value.data.plan?.slug ?? null);
      }
      if (channelsRes.status === "fulfilled") {
        const dh = pickDirectHosted(channelsRes.value.data ?? []);
        if (dh) setChannel({ id: dh.id, slug: dh.slug });
      }
      if (sessionsRes.status === "fulfilled") {
        setExistingSessions(
          (sessionsRes.value.data ?? []).map((s) => ({
            id: s.id,
            service_id: s.service_id ?? null,
            provider_id: s.provider_id ?? null,
            start_time: s.start_time,
            end_time: s.end_time,
            capacity: s.capacity ?? 0,
            price_mad: Number(s.price_mad ?? 0),
          })),
        );
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [entityId]);

  return useMemo(
    () => ({
      loading,
      entityId,
      currency,
      profile,
      setProfile,
      color,
      setColor,
      policies,
      setPolicies,
      services,
      setServices,
      providers,
      setProviders,
      categories,
      plans,
      currentPlanSlug,
      refreshSubscription,
      channel,
      setChannelSlug,
      existingSessions,
      saved,
      flashSaved,
    }),
    [
      loading,
      entityId,
      currency,
      profile,
      setProfile,
      color,
      policies,
      setPolicies,
      services,
      providers,
      categories,
      plans,
      currentPlanSlug,
      refreshSubscription,
      channel,
      setChannelSlug,
      existingSessions,
      saved,
      flashSaved,
    ],
  );
}

// ── Row mappers (raw studioApi object → local row) ───────────────────────────

export function toServiceRow(s: {
  id: string;
  name: string;
  category_id?: string | null;
  duration_minutes?: number;
  capacity?: number;
  base_price?: number | string;
  description?: string | null;
  short_description?: string | null;
  is_featured?: boolean;
}): ServiceRow {
  return {
    id: s.id,
    name: s.name,
    category_id: s.category_id ?? null,
    duration_minutes: s.duration_minutes ?? 60,
    capacity: s.capacity ?? 10,
    base_price: Number(s.base_price ?? 0),
    description: s.description ?? null,
    short_description: s.short_description ?? null,
    is_featured: !!s.is_featured,
  };
}

export function toProviderRow(p: {
  id: string;
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
}): ProviderRow {
  return {
    id: p.id,
    name: p.name,
    title: p.title ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    tier: p.tier ?? null,
    experience_years: p.experience_years ?? null,
    base_rate: p.base_rate ?? null,
    specializations: p.specializations ?? null,
    short_bio: p.short_bio ?? null,
    bio: p.bio ?? null,
    avatar_url: p.avatar_url ?? null,
    is_active: p.is_active ?? true,
    is_featured: !!p.is_featured,
    display_order: p.display_order ?? null,
    social_links: p.social_links ?? null,
  };
}

// ── Shared helpers ───────────────────────────────────────────────────────────

/** Slugify a studio name into a booking handle candidate. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
