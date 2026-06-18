"use client";

import { BaseLayout } from "@/components/layout/base-layout";
import { DataTable, type Column, type RowAction } from "@/components/shared/data-table";
import { FormSheet } from "@/components/shared/form-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { entityPlansApi } from "@/lib/api/entityPlans";
import { studioApi } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import { formatMoneyWhole } from "@/lib/money";
import Link from "next/link";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CoinsIcon,
  ListIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  UsersIcon,
  XCircleIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  waitlist_count: number;
  status: string;
  /** Publication lifecycle: 'draft' (studio-only, deletable) or 'published' (live, cancel-only). */
  lifecycle_status?: string;
  /** Shared id across a recurring series — enables "cancel whole series". */
  recurrence_group_id?: string | null;
  // MAD-based pricing (spec A)
  price_mad?: number;
  marketplace_price_mad?: number;
  marketplace_markup_pct?: number;
  instructor_tier?: string;
  is_recurring: boolean;
  notes?: string;
  service?: { id: string; name: string; slug?: string; duration_minutes?: number };
  provider?: { id: string; name: string; avatar_url?: string; tier?: string };
}

interface Service {
  id: string;
  name: string;
  /** MAD price set on the service — the preferred source of truth for session pricing default. */
  base_price?: number;
  credit_price: number;
  duration_minutes: number;
  capacity: number;
}

/**
 * Resolve a service's default MAD price for new sessions.
 * Prefers `services.base_price` (the studio-facing MAD field); falls back to the
 * legacy `credit_price × CREDIT_VALUE_MAD` math for older services that haven't
 * been migrated yet.
 */
const serviceDefaultPriceMad = (svc: Pick<Service, "base_price" | "credit_price"> | undefined): number => {
  if (!svc) return 0;
  if (svc.base_price != null && svc.base_price > 0) return Number(svc.base_price);
  return (svc.credit_price || 0) * CREDIT_VALUE_MAD;
};

interface Provider {
  id: string;
  name: string;
  tier?: string;
}

type ViewMode = "week" | "day" | "list";

// Spec A interim: services still expose credit_price, but sessions are priced
// in MAD. Use this constant to convert when defaulting from service pricing.
// Must match moovli-api's CREDIT_VALUE_MAD env (default 10).
const CREDIT_VALUE_MAD = 10;

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  available: { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-l-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  full: { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-l-amber-500", text: "text-amber-700 dark:text-amber-300" },
  cancelled: { bg: "bg-red-50 dark:bg-red-950/40", border: "border-l-red-500", text: "text-red-700 dark:text-red-300 line-through opacity-60" },
  completed: { bg: "bg-gray-50 dark:bg-gray-900/40", border: "border-l-gray-400", text: "text-gray-500 dark:text-gray-400" },
};

// Old / due sessions (already ended) render in a muted gray treatment in every
// view, regardless of their status — so the calendar reads "past = done".
const PAST_COLORS = {
  bg: "bg-gray-50 dark:bg-gray-900/40",
  border: "border-l-gray-300 dark:border-l-gray-700",
  text: "text-gray-400 dark:text-gray-500",
};

const isPastSession = (s: { end_time: string }) => new Date(s.end_time) < new Date();

// Group sessions whose time ranges overlap into clusters, so the calendar can
// lay them out side-by-side (Google-Calendar style) instead of stacking them.
const clusterByOverlap = <T extends { start_time: string; end_time: string }>(items: T[]): T[][] => {
  const sorted = [...items].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const clusters: T[][] = [];
  let current: T[] = [];
  let clusterEnd = 0;
  for (const s of sorted) {
    const start = new Date(s.start_time).getTime();
    const end = new Date(s.end_time).getTime();
    if (current.length === 0 || start < clusterEnd) {
      current.push(s);
      clusterEnd = Math.max(clusterEnd, end);
    } else {
      clusters.push(current);
      current = [s];
      clusterEnd = end;
    }
  }
  if (current.length) clusters.push(current);
  return clusters;
};

// Max columns rendered side-by-side before collapsing the rest into "+N more".
const MAX_OVERLAP_COLUMNS = 3;

// Resolve the visual palette for a session: past sessions are always grayed out,
// otherwise we use the status palette.
const sessionColors = (s: { end_time: string; status: string }) =>
  isPastSession(s) ? PAST_COLORS : STATUS_COLORS[s.status] || STATUS_COLORS.available;

// ============================================================================
// HOURS CONFIG (for calendar time grid)
// ============================================================================

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 — 22:00
const HOUR_HEIGHT = 64; // px per hour

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SchedulePage() {
  const activeEntity = useActiveEntity();
  const currency = activeEntity.currencyCode;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("week");

  // Filters — applied client-side over the fetched window so all three views
  // stay in sync without refetching.
  const [lifecycleFilter, setLifecycleFilter] = useState<"all" | "draft" | "published">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);

  const [calendarDate, setCalendarDate] = useState(new Date());

  const [form, setForm] = useState({
    service_id: "",
    provider_id: "",
    date: "",
    start_time: "",
    end_time: "",
    capacity: "",
    price_mad: "",
    notes: "",
    is_recurring: false,
    override_pricing: false,
    publish_marketplace: true,
    publish_direct: true,
    // Channel allocation: 'shared' = any channel can book any spot (current default).
    // 'split' = each channel has its own quota out of the total capacity.
    allocation_mode: "shared" as "shared" | "split",
    allocation_marketplace: "",
    allocation_direct: "",
    // Phase 2: time-based release of allocations back to shared pool
    release_enabled: false,
    release_value: "6",
    release_unit: "hours" as "minutes" | "hours" | "days",
    // Recurrence (like Google Calendar)
    repeat_mode: "none" as "none" | "daily" | "weekly",
    repeat_interval: "1",
    repeat_weekdays: [] as Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">,
    repeat_end_mode: "until" as "until" | "count",
    repeat_until: "",
    repeat_count: "10",
    // Anchored allocation: which channel the studio explicitly typed a value
    // for. The other gets `capacity − anchored` automatically. Null = use a
    // 50/50 default split when split mode is first chosen.
    allocation_anchor: null as "direct" | "marketplace" | null,
  });

  const entityId = activeEntity.entityId;
  const currentRole = activeEntity.role;
  const canManage = currentRole === "manager" || currentRole === "owner";

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchSessions = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await studioApi.getSessions(entityId, { page: 1, limit: 200 });
      setSessions(res.data);
      setTotal(res.pagination.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Apply lifecycle + status filters client-side (shared across all views).
  // "active" = available/full; "inactive" = cancelled/completed.
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (lifecycleFilter !== "all" && (s.lifecycle_status ?? "published") !== lifecycleFilter) {
        return false;
      }
      if (statusFilter === "active" && !["available", "full"].includes(s.status)) return false;
      if (statusFilter === "inactive" && !["cancelled", "completed"].includes(s.status)) return false;
      return true;
    });
  }, [sessions, lifecycleFilter, statusFilter]);

  useEffect(() => {
    if (!entityId) return;
    Promise.all([
      studioApi.getServices(entityId),
      studioApi.getProviders(entityId),
    ]).then(([sRes, pRes]) => {
      setServices(sRes.data);
      setProviders(pRes.data);
    }).catch(console.error);
  }, [entityId]);

  // Per-channel availability state — drives the publish-toggle locks below.
  // direct + marketplace can each be: "live" (plan allows + enabled),
  // "off" (plan allows but switched off in /studio/channels) or
  // "locked" (plan doesn't include it).
  const [channelState, setChannelState] = useState<{
    direct: "live" | "off" | "locked";
    marketplace: "live" | "off" | "locked";
  }>({ direct: "live", marketplace: "live" });

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    Promise.all([
      entityPlansApi.getSubscription(entityId),
      studioApi.getChannelPrefs(entityId),
    ])
      .then(([subRes, prefRes]) => {
        if (cancelled) return;
        const allowed = subRes.data.plan?.allowed_channel_types ?? [];
        const allows = (k: "direct_hosted" | "marketplace") => allowed.includes(k);
        setChannelState({
          direct: !allows("direct_hosted")
            ? "locked"
            : prefRes.data.direct_hosted_enabled
              ? "live"
              : "off",
          marketplace: !allows("marketplace")
            ? "locked"
            : prefRes.data.marketplace_enabled
              ? "live"
              : "off",
        });
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  // ============================================================================
  // FORM ACTIONS
  // ============================================================================

  /**
   * Open the create dialog. start/end are minutes-since-midnight on the given date.
   * - `start` undefined → no time prefill (used by the "New Session" header button)
   * - `end` undefined → end is computed from the chosen service's duration
   * - both provided → fixed range (used by calendar drag-to-create)
   */
  const openCreate = (date?: Date, startMinutes?: number, endMinutes?: number) => {
    setEditingSession(null);
    const d = date || new Date();
    const dateStr = d.toISOString().split("T")[0];
    const fmt = (mins: number) =>
      `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    const startStr = startMinutes != null ? fmt(startMinutes) : "";
    const fixedEnd = endMinutes != null ? fmt(endMinutes) : "";
    setForm({
      service_id: services[0]?.id || "",
      provider_id: "",
      date: dateStr,
      start_time: startStr,
      end_time: fixedEnd || (startStr && services[0] ? addMinutes(startStr, services[0].duration_minutes) : ""),
      capacity: services[0] ? String(services[0].capacity) : "12",
      price_mad: services[0] ? String(serviceDefaultPriceMad(services[0])) : "50",
      notes: "",
      is_recurring: false,
      override_pricing: false,
      // Default each channel to ON only if it's actually live at the studio
      // level. Channels that are off or plan-gated stay unchecked so the
      // studio can't accidentally try to publish to them.
      publish_marketplace: channelState.marketplace === "live",
      publish_direct: channelState.direct === "live",
      allocation_mode: "shared",
      allocation_marketplace: "",
      allocation_direct: "",
      allocation_anchor: null,
      release_enabled: false,
      release_value: "6",
      release_unit: "hours",
      repeat_mode: "none",
      repeat_interval: "1",
      repeat_weekdays: [],
      repeat_end_mode: "until",
      repeat_until: "",
      repeat_count: "10",
    });
    setDialogOpen(true);
  };

  const openEdit = (s: Session) => {
    setEditingSession(s);
    const d = new Date(s.start_time);
    const svc = services.find((sv) => sv.id === s.service?.id);
    const serviceDefaultMad = serviceDefaultPriceMad(svc);
    const hasOverride = svc ? (s.price_mad || 0) !== serviceDefaultMad : false;
    setForm({
      service_id: s.service?.id || "",
      provider_id: s.provider?.id || "",
      date: d.toISOString().split("T")[0],
      start_time: d.toTimeString().slice(0, 5),
      end_time: new Date(s.end_time).toTimeString().slice(0, 5),
      capacity: String(s.capacity),
      price_mad: String(s.price_mad || ""),
      override_pricing: hasOverride,
      notes: s.notes || "",
      is_recurring: s.is_recurring,
      publish_marketplace: channelState.marketplace === "live",
      publish_direct: channelState.direct === "live",
      allocation_mode: "shared",
      allocation_marketplace: "",
      allocation_direct: "",
      allocation_anchor: null,
      release_enabled: false,
      release_value: "6",
      release_unit: "hours",
      repeat_mode: "none",
      repeat_interval: "1",
      repeat_weekdays: [],
      repeat_end_mode: "until",
      repeat_until: "",
      repeat_count: "10",
    });
    setDialogOpen(true);
  };

  // `publish` only matters when creating: true → goes live immediately,
  // false → saved as a draft. Ignored on edit (use the Publish action instead).
  const handleSave = async (publish = false) => {
    if (!entityId) return;
    setSaving(true);
    try {
      const svc = services.find((s) => s.id === form.service_id);
      const priceMad = form.override_pricing
        ? parseFloat(form.price_mad) || 0
        : serviceDefaultPriceMad(svc) || parseFloat(form.price_mad) || 0;

      const channelTypes: string[] = [];
      if (form.publish_marketplace) channelTypes.push("marketplace");
      if (form.publish_direct) channelTypes.push("direct_hosted");

      // Only send channel_allocations when in split mode. Compute effective
      // per-channel seats using the same anchored-balance logic as the UI so
      // an empty input (anchor === null) saves the 50/50 default rather than 0.
      const channelAllocations: Record<string, number> | undefined = (() => {
        if (form.allocation_mode !== "split") return undefined;
        const cap = parseInt(form.capacity) || 0;
        const both = form.publish_direct && form.publish_marketplace;
        const anchor = form.allocation_anchor;
        const anchored =
          anchor === "direct"
            ? clampAlloc(form.allocation_direct, cap)
            : anchor === "marketplace"
              ? clampAlloc(form.allocation_marketplace, cap)
              : null;

        let directSeats: number;
        let marketplaceSeats: number;
        if (!both) {
          directSeats = form.publish_direct ? cap : 0;
          marketplaceSeats = form.publish_marketplace ? cap : 0;
        } else if (anchor === "direct" && anchored != null) {
          directSeats = anchored;
          marketplaceSeats = cap - anchored;
        } else if (anchor === "marketplace" && anchored != null) {
          marketplaceSeats = anchored;
          directSeats = cap - anchored;
        } else {
          directSeats = Math.ceil(cap / 2);
          marketplaceSeats = cap - directSeats;
        }

        const out: Record<string, number> = {};
        if (form.publish_direct) out.direct_hosted = directSeats;
        if (form.publish_marketplace) out.marketplace = marketplaceSeats;
        return out;
      })();

      // Convert release_value + unit → minutes for API
      const UNIT_TO_MINUTES = { minutes: 1, hours: 60, days: 1440 } as const;
      const releaseMinutesBefore =
        form.allocation_mode === "split" && form.release_enabled
          ? (parseInt(form.release_value) || 0) * UNIT_TO_MINUTES[form.release_unit]
          : undefined;

      // Build recurrence rule (only when repeat_mode !== "none")
      let recurrence: Record<string, unknown> | undefined;
      if (form.repeat_mode !== "none") {
        const rule: Record<string, unknown> = {
          frequency: form.repeat_mode,
          interval: Math.max(1, parseInt(form.repeat_interval) || 1),
        };
        if (form.repeat_mode === "weekly" && form.repeat_weekdays.length > 0) {
          rule.by_weekday = form.repeat_weekdays;
        }
        if (form.repeat_end_mode === "until" && form.repeat_until) {
          rule.until = form.repeat_until;
        } else if (form.repeat_end_mode === "count") {
          rule.count = Math.max(1, parseInt(form.repeat_count) || 1);
        }
        recurrence = rule;
      }

      const payload = {
        service_id: form.service_id,
        provider_id: form.provider_id || null,
        start_time: `${form.date}T${form.start_time}:00Z`,
        end_time: `${form.date}T${form.end_time}:00Z`,
        capacity: parseInt(form.capacity),
        price_mad: priceMad,
        notes: form.notes || null,
        publish,
        publish_to_channel_types: channelTypes,
        ...(channelAllocations ? { channel_allocations: channelAllocations } : {}),
        ...(releaseMinutesBefore != null
          ? { release_minutes_before: releaseMinutesBefore }
          : {}),
        ...(recurrence ? { recurrence } : {}),
      };
      if (editingSession) {
        await studioApi.updateSession(entityId, editingSession.id, payload);
      } else {
        await studioApi.createSession(entityId, payload);
      }
      setDialogOpen(false);
      fetchSessions();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Draft only — hard delete. The backend rejects deleting published sessions.
  const handleDelete = async (session: Session) => {
    if (!entityId || !confirm("Delete this draft session? This cannot be undone.")) return;
    try {
      await studioApi.deleteSession(entityId, session.id);
      fetchSessions();
    } catch (e) {
      console.error(e);
      alert((e as Error).message || "Failed to delete session");
    }
  };

  // Draft → published (goes live on its channels).
  const handlePublish = async (session: Session) => {
    if (!entityId) return;
    try {
      await studioApi.publishSession(entityId, session.id, {
        publish_to_channel_types: [
          ...(channelState.marketplace === "live" ? ["marketplace"] : []),
          ...(channelState.direct === "live" ? ["direct_hosted"] : []),
        ],
      });
      fetchSessions();
    } catch (e) {
      console.error(e);
      alert((e as Error).message || "Failed to publish session");
    }
  };

  // Published → cancelled. Recurring sessions offer to cancel the whole series.
  const handleCancel = async (session: Session) => {
    if (!entityId) return;
    let scope: "single" | "series" = "single";
    if (session.recurrence_group_id) {
      scope = confirm(
        "This session is part of a recurring series.\n\nOK = cancel the ENTIRE series.\nCancel = cancel only this one session.",
      )
        ? "series"
        : "single";
    } else if (!confirm("Cancel this session?")) {
      return;
    }
    try {
      await studioApi.cancelSession(entityId, session.id, scope);
      fetchSessions();
    } catch (e) {
      console.error(e);
      alert((e as Error).message || "Failed to cancel session");
    }
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    setForm((prev) => ({
      ...prev,
      service_id: serviceId,
      capacity: service ? String(service.capacity) : prev.capacity,
      price_mad: service ? String(serviceDefaultPriceMad(service)) : prev.price_mad,
      end_time: service && prev.start_time ? addMinutes(prev.start_time, service.duration_minutes) : prev.end_time,
    }));
  };

  // ============================================================================
  // CALENDAR DATA
  // ============================================================================

  const weekStart = getWeekStart(calendarDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const dayForView = view === "day" ? calendarDate : null;

  const getSessionsForDay = (day: Date) => {
    const dayStr = day.toISOString().split("T")[0];
    return filteredSessions
      .filter((s) => s.start_time.startsWith(dayStr))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const getSessionPosition = (s: Session) => {
    const start = new Date(s.start_time);
    const end = new Date(s.end_time);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const top = (startHour - 6) * HOUR_HEIGHT;
    const height = Math.max((endHour - startHour) * HOUR_HEIGHT, 24);
    return { top, height };
  };

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  const navigateCalendar = (dir: number) => {
    const d = new Date(calendarDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setCalendarDate(d);
  };

  const goToToday = () => setCalendarDate(new Date());

  const headerLabel = useMemo(() => {
    if (view === "day") {
      return calendarDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }
    return `${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }, [calendarDate, view, weekDays]);

  // ============================================================================
  // LIST COLUMNS
  // ============================================================================

  const columns: Column<Session>[] = [
    { header: "Service", cell: (r) => <span className="font-medium">{r.service?.name || "N/A"}</span> },
    { header: "Instructor", cell: (r) => <span>{r.provider?.name || "—"}</span> },
    {
      header: "Date & Time",
      cell: (r) => (
        <div className="text-sm">
          <p>{new Date(r.start_time).toLocaleDateString()}</p>
          <p className="text-muted-foreground">{formatTime(r.start_time)} — {formatTime(r.end_time)}</p>
        </div>
      ),
    },
    { header: "Spots", cell: (r) => <span>{r.booked_count}/{r.capacity}{r.waitlist_count > 0 ? ` +${r.waitlist_count} wl` : ""}</span> },
    { header: "Price", cell: (r) => <span>{r.price_mad != null ? formatMoneyWhole(r.price_mad, currency) : "—"}</span> },
    {
      header: "Status",
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          {(r.lifecycle_status ?? "published") === "draft" && (
            <Badge variant="outline" className="text-[10px] border-dashed">Draft</Badge>
          )}
          <Badge variant="outline" className={`${STATUS_COLORS[r.status]?.bg || ""} ${STATUS_COLORS[r.status]?.text || ""}`}>
            {r.status}
          </Badge>
        </div>
      ),
    },
  ];

  // Lifecycle-aware row actions shared by the list view kebab.
  const sessionRowActions = (s: Session): RowAction[] => {
    const isDraft = (s.lifecycle_status ?? "published") === "draft";
    const actions: RowAction[] = [
      { label: "Edit", icon: PencilIcon, onClick: () => openEdit(s) },
    ];
    if (isDraft) {
      actions.push({ label: "Publish", icon: SendIcon, onClick: () => handlePublish(s) });
      actions.push({
        label: "Delete",
        icon: Trash2Icon,
        variant: "destructive",
        separatorBefore: true,
        onClick: () => handleDelete(s),
      });
    } else {
      actions.push({
        label: s.recurrence_group_id ? "Cancel…" : "Cancel session",
        icon: XCircleIcon,
        variant: "destructive",
        separatorBefore: true,
        onClick: () => handleCancel(s),
      });
    }
    return actions;
  };

  // ============================================================================
  // RENDER: SESSION CARD (for calendar)
  // ============================================================================

  const SessionCard = ({ session, compact }: { session: Session; compact?: boolean }) => {
    const colors = sessionColors(session);
    const isDraft = (session.lifecycle_status ?? "published") === "draft";
    return (
      <button
        onClick={() => canManage ? openEdit(session) : undefined}
        className={`w-full text-left rounded-md border-l-[3px] px-2 py-1 transition-all hover:shadow-sm ${colors.bg} ${colors.border} ${isDraft ? "border border-dashed" : ""} ${canManage ? "cursor-pointer" : ""}`}
      >
        <p className={`text-xs font-medium truncate ${colors.text}`}>
          {isDraft && <span className="font-semibold">[Draft] </span>}
          {session.service?.name || "Session"}
        </p>
        {!compact && (
          <>
            <p className="text-[10px] text-muted-foreground">
              {formatTime(session.start_time)} — {formatTime(session.end_time)}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <UsersIcon className="size-2.5" />{session.booked_count}/{session.capacity}
              </span>
              {session.provider?.name && (
                <span className="text-[10px] text-muted-foreground truncate">{session.provider.name}</span>
              )}
            </div>
          </>
        )}
      </button>
    );
  };

  // ============================================================================
  // RENDER: TIME COLUMN
  // ============================================================================

  const TimeColumn = () => (
    <div className="w-16 shrink-0 relative border-r border-border">
      {HOURS.map((h) => (
        <div key={h} className="absolute w-full pr-2 text-right" style={{ top: (h - 6) * HOUR_HEIGHT - 6 }}>
          <span className="text-[10px] text-muted-foreground">{`${String(h).padStart(2, "0")}:00`}</span>
        </div>
      ))}
    </div>
  );

  // ============================================================================
  // RENDER: DAY COLUMN (for week/day view)
  // ============================================================================

  const DayColumn = ({ day, isOnly }: { day: Date; isOnly?: boolean }) => {
    const daySessions = getSessionsForDay(day);
    const isToday = day.toDateString() === new Date().toDateString();

    // Current time indicator
    const now = new Date();
    const nowTop = isToday ? (now.getHours() + now.getMinutes() / 60 - 6) * HOUR_HEIGHT : -1;

    // Drag-to-create state. Minutes are minutes-since-midnight, quantized to 30-min steps.
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [drag, setDrag] = useState<{ startMin: number; currentMin: number } | null>(null);
    const GRID_START_MIN = HOURS[0] * 60;
    const STEP_MIN = 30;

    const yToMinutes = (clientY: number): number => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return GRID_START_MIN;
      const y = Math.max(0, Math.min(clientY - rect.top, HOURS.length * HOUR_HEIGHT));
      const minutesFromGridStart = (y / HOUR_HEIGHT) * 60;
      const quantized = Math.floor(minutesFromGridStart / STEP_MIN) * STEP_MIN;
      return GRID_START_MIN + quantized;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
      if (!canManage || e.button !== 0) return;
      const m = yToMinutes(e.clientY);
      setDrag({ startMin: m, currentMin: m });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!drag) return;
      const m = yToMinutes(e.clientY);
      if (m !== drag.currentMin) setDrag({ ...drag, currentMin: m });
    };

    const handleMouseUp = (e: React.MouseEvent) => {
      if (!drag) return;
      const endY = yToMinutes(e.clientY);
      const startMin = Math.min(drag.startMin, endY);
      const endMin = Math.max(drag.startMin, endY);
      setDrag(null);
      if (startMin === endMin) {
        // Click without drag — single half-hour slot, end_time computed from service duration.
        openCreate(day, startMin);
      } else {
        // Drag — end_time is the upper bound + 1 step (so dragging from 18:00 to 19:00 produces 18:00–19:30).
        openCreate(day, startMin, endMin + STEP_MIN);
      }
    };

    const handleMouseLeave = () => {
      if (drag) setDrag(null);
    };

    // Ghost rectangle showing the proposed range while dragging.
    const ghost = drag
      ? (() => {
        const lo = Math.min(drag.startMin, drag.currentMin);
        const hi = Math.max(drag.startMin, drag.currentMin) + STEP_MIN;
        const top = ((lo - GRID_START_MIN) / 60) * HOUR_HEIGHT;
        const height = ((hi - lo) / 60) * HOUR_HEIGHT;
        const fmt = (mins: number) =>
          `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
        return { top, height, label: `${fmt(lo)} — ${fmt(hi)}` };
      })()
      : null;

    return (
      <div
        ref={containerRef}
        className={`relative flex-1 min-w-0 ${!isOnly ? "border-r border-border last:border-r-0" : ""} ${canManage ? "cursor-cell select-none" : ""
          }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Hour grid lines — purely visual now; click/drag is handled by the container. */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute w-full border-t border-border/50 pointer-events-none"
            style={{ top: (h - 6) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
          >
            <div
              className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/30"
              style={{ marginTop: -1 }}
            />
          </div>
        ))}

        {/* Drag ghost */}
        {ghost && (
          <div
            className="absolute left-1 right-1 z-[6] rounded-md border-2 border-primary bg-primary/15 pointer-events-none flex items-start justify-center px-2 py-1"
            style={{ top: ghost.top, height: Math.max(ghost.height - 2, 22) }}
          >
            <span className="text-[10px] font-semibold text-primary">{ghost.label}</span>
          </div>
        )}

        {/* Current time line */}
        {nowTop > 0 && (
          <div className="absolute left-0 right-0 z-10 flex items-center" style={{ top: nowTop }}>
            <div className="size-2 rounded-full bg-primary -ml-1" />
            <div className="flex-1 h-px bg-primary" />
          </div>
        )}

        {/* Sessions — overlapping ones are laid out in up to 3 side-by-side
            columns (Google-Calendar style); any beyond that collapse into a
            "+N more" chip that opens the day view. */}
        {clusterByOverlap(daySessions).flatMap((cluster) => {
          const size = cluster.length;
          const colCount = Math.min(size, MAX_OVERLAP_COLUMNS);
          const widthPct = 100 / colCount;
          const overflow = size > MAX_OVERLAP_COLUMNS;
          const visible = overflow ? cluster.slice(0, MAX_OVERLAP_COLUMNS - 1) : cluster;

          const nodes = visible.map((s, i) => {
            const { top, height } = getSessionPosition(s);
            return (
              <div
                key={s.id}
                className="absolute z-[5]"
                style={{
                  top,
                  height: Math.max(height - 2, 22),
                  left: `calc(${i * widthPct}% + 2px)`,
                  width: `calc(${widthPct}% - 4px)`,
                }}
              >
                <SessionCard session={s} compact={height < 40 || colCount > 1} />
              </div>
            );
          });

          if (overflow) {
            const top = Math.min(...cluster.map((s) => getSessionPosition(s).top));
            const lastCol = MAX_OVERLAP_COLUMNS - 1;
            nodes.push(
              <div
                key={`more-${cluster[0].id}`}
                className="absolute z-[6]"
                style={{ top, left: `calc(${lastCol * widthPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
              >
                <button
                  onClick={() => { setCalendarDate(new Date(cluster[0].start_time)); setView("day"); }}
                  className="w-full rounded-md border border-dashed border-border bg-muted/60 px-1 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted"
                >
                  +{size - (MAX_OVERLAP_COLUMNS - 1)} more
                </button>
              </div>,
            );
          }

          return nodes;
        })}
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <BaseLayout
      maxWidth="full"
      gap="tight"
      title="Schedule"
      subtitle={`${total} sessions`}
      action={
        <>
          <div className="flex border border-border rounded-lg overflow-hidden">
            {(["day", "week", "list"] as ViewMode[]).map((v) => (
              <Button
                key={v}
                variant={view === v ? "secondary" : "ghost"}
                size="sm"
                className="rounded-none capitalize text-xs px-3"
                onClick={() => setView(v)}
              >
                {v === "list" ? <ListIcon className="size-3.5 mr-1" /> :
                  v === "day" ? <ClockIcon className="size-3.5 mr-1" /> :
                    <CalendarIcon className="size-3.5 mr-1" />}
                {v}
              </Button>
            ))}
          </div>
          {canManage && (
            <Button onClick={() => openCreate()}>
              <PlusIcon className="size-4 mr-1.5" />
              New Session
            </Button>
          )}
        </>
      }
    >
      {/* Filters — lifecycle (draft/published) + status (active/inactive) */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={lifecycleFilter} onValueChange={(v) => setLifecycleFilter(v as typeof lifecycleFilter)}>
          <SelectTrigger size="sm" className="w-auto min-w-32">
            <SelectValue placeholder="Lifecycle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sessions</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger size="sm" className="w-auto min-w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filteredSessions.length} of {sessions.length} shown
        </span>
      </div>

      {/* Calendar navigation */}
      {view !== "list" && (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => navigateCalendar(-1)}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => navigateCalendar(1)}>
            <ChevronRightIcon className="size-4" />
          </Button>
          <h2 className="text-sm font-medium">{headerLabel}</h2>
        </div>
      )}

      {/* Week View */}
      {view === "week" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Day headers */}
          <div className="flex border-b border-border">
            <div className="w-16 shrink-0" />
            {weekDays.map((day) => {
              const isToday = day.toDateString() === new Date().toDateString();
              const daySessionCount = getSessionsForDay(day).length;
              return (
                <div
                  key={day.toISOString()}
                  className={`flex-1 text-center py-2 border-r border-border last:border-r-0 cursor-pointer hover:bg-muted/50 ${isToday ? "bg-primary/5" : ""}`}
                  onClick={() => { setCalendarDate(day); setView("day"); }}
                >
                  <p className="text-[10px] text-muted-foreground uppercase">{day.toLocaleDateString("en-US", { weekday: "short" })}</p>
                  <p className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>{day.getDate()}</p>
                  {daySessionCount > 0 && (
                    <p className="text-[10px] text-muted-foreground">{daySessionCount} session{daySessionCount > 1 ? "s" : ""}</p>
                  )}
                </div>
              );
            })}
          </div>
          {/* Time grid */}
          <div className="flex overflow-y-auto" style={{ height: HOURS.length * HOUR_HEIGHT }}>
            <TimeColumn />
            {weekDays.map((day) => (
              <DayColumn key={day.toISOString()} day={day} />
            ))}
          </div>
        </div>
      )}

      {/* Day View */}
      {view === "day" && dayForView && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex overflow-y-auto" style={{ height: HOURS.length * HOUR_HEIGHT }}>
            <TimeColumn />
            <DayColumn day={dayForView} isOnly />
          </div>
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <DataTable
          columns={columns}
          data={filteredSessions}
          page={page}
          pageSize={50}
          onPageChange={setPage}
          rowActions={canManage ? sessionRowActions : undefined}
          isLoading={loading}
        />
      )}

      {/* Create / Edit sheet */}
      <FormSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingSession ? "Edit session" : "New session"}
        subtitle={
          editingSession
            ? "Update the details of this session."
            : "Schedule a session and choose where it's published."
        }
        icon={editingSession ? PencilIcon : CalendarIcon}
        iconAccent="emerald"
        width="lg"
        footer={(() => {
          const formInvalid =
            saving ||
            !form.service_id ||
            !form.date ||
            !form.start_time ||
            !form.end_time ||
            !form.capacity;
          const isDraft = (editingSession?.lifecycle_status ?? "published") === "draft";
          return (
            <>
              {/* Destructive lifecycle action (left-aligned) */}
              {editingSession && canManage && (
                isDraft ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mr-auto text-destructive hover:text-destructive"
                    onClick={() => { handleDelete(editingSession); setDialogOpen(false); }}
                  >
                    <Trash2Icon className="size-3.5 mr-1.5" /> Delete draft
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mr-auto text-destructive hover:text-destructive"
                    onClick={() => { handleCancel(editingSession); setDialogOpen(false); }}
                  >
                    <XCircleIcon className="size-3.5 mr-1.5" /> Cancel session
                  </Button>
                )
              )}
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Close
              </Button>

              {editingSession ? (
                <>
                  {/* Draft sessions can be published straight from the editor. */}
                  {canManage && isDraft && (
                    <Button
                      variant="outline"
                      disabled={formInvalid}
                      onClick={async () => { await handleSave(false); await handlePublish(editingSession); }}
                    >
                      <SendIcon className="size-4 mr-1.5" /> Publish
                    </Button>
                  )}
                  <Button onClick={() => handleSave(false)} disabled={formInvalid}>
                    {saving ? "Saving…" : "Update"}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => handleSave(false)} disabled={formInvalid}>
                    {saving ? "Saving…" : "Save as draft"}
                  </Button>
                  <Button onClick={() => handleSave(true)} disabled={formInvalid}>
                    <SendIcon className="size-4 mr-1.5" /> Publish
                  </Button>
                </>
              )}
            </>
          );
        })()}
      >
        <div className="space-y-5">
          {/* What — which service */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">What</p>
            <Select value={form.service_id} onValueChange={handleServiceChange}>
              <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <span>{s.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {s.duration_minutes}min · {formatMoneyWhole(serviceDefaultPriceMad(s), currency)} · {s.capacity} spots
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Who — instructor */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Who teaches</p>
            <Select value={form.provider_id || "none"} onValueChange={(v) => setForm({ ...form, provider_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No instructor assigned</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.tier ? ` · ${p.tier}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* When — date + time */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">When</p>
            <div className="space-y-3">
              <Input type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Start time</label>
                  <Input type="time" className="mt-1" value={form.start_time}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      const service = services.find((s) => s.id === form.service_id);
                      setForm({ ...form, start_time: newStart, end_time: service ? addMinutes(newStart, service.duration_minutes) : form.end_time });
                    }} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">End time</label>
                  <Input type="time" className="mt-1" value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>
              {form.start_time && form.end_time && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ClockIcon className="size-3" />
                  Duration: {calcDuration(form.start_time, form.end_time)} min
                  {form.service_id && (() => {
                    const svc = services.find(s => s.id === form.service_id);
                    const dur = calcDuration(form.start_time, form.end_time);
                    return svc && dur !== svc.duration_minutes
                      ? <span className="text-amber-600 ml-1">(service default: {svc.duration_minutes} min)</span>
                      : null;
                  })()}
                </p>
              )}
            </div>
          </div>

          {/* Repeats — like Google Calendar */}
          {!editingSession && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Repeats
              </p>
              <Select
                value={form.repeat_mode}
                onValueChange={(v) =>
                  setForm({ ...form, repeat_mode: v as "none" | "daily" | "weekly" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Doesn&apos;t repeat</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>

              {form.repeat_mode !== "none" && (
                <div className="mt-3 space-y-3 rounded-lg border p-3 bg-muted/30">
                  {/* Interval */}
                  <div className="flex items-center gap-2 text-xs">
                    <span>Every</span>
                    <Input
                      type="number"
                      min="1"
                      max="52"
                      value={form.repeat_interval}
                      onChange={(e) => setForm({ ...form, repeat_interval: e.target.value })}
                      className="h-7 w-16 text-right"
                    />
                    <span>
                      {form.repeat_mode === "daily"
                        ? parseInt(form.repeat_interval) === 1 ? "day" : "days"
                        : parseInt(form.repeat_interval) === 1 ? "week" : "weeks"}
                    </span>
                  </div>

                  {/* Weekday selector (weekly only) */}
                  {form.repeat_mode === "weekly" && (
                    <div className="space-y-1.5">
                      <div className="text-xs text-muted-foreground">On these days</div>
                      <div className="flex gap-1">
                        {([
                          { id: "mon", label: "M" },
                          { id: "tue", label: "T" },
                          { id: "wed", label: "W" },
                          { id: "thu", label: "T" },
                          { id: "fri", label: "F" },
                          { id: "sat", label: "S" },
                          { id: "sun", label: "S" },
                        ] as const).map((d) => {
                          const on = form.repeat_weekdays.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() =>
                                setForm({
                                  ...form,
                                  repeat_weekdays: on
                                    ? form.repeat_weekdays.filter((w) => w !== d.id)
                                    : [...form.repeat_weekdays, d.id],
                                })
                              }
                              className={`size-8 rounded-full text-xs font-medium border transition ${on
                                  ? "bg-foreground text-background border-foreground"
                                  : "border-input hover:bg-accent"
                                }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Leave empty to use the start date&apos;s weekday only.
                      </p>
                    </div>
                  )}

                  {/* End condition */}
                  <div className="space-y-1.5">
                    <div className="text-xs text-muted-foreground">Ends</div>
                    <div className="flex items-center gap-2 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="repeat_end_mode"
                          checked={form.repeat_end_mode === "until"}
                          onChange={() => setForm({ ...form, repeat_end_mode: "until" })}
                        />
                        On
                      </label>
                      <Input
                        type="date"
                        value={form.repeat_until}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            repeat_until: e.target.value,
                            repeat_end_mode: "until",
                          })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="repeat_end_mode"
                          checked={form.repeat_end_mode === "count"}
                          onChange={() => setForm({ ...form, repeat_end_mode: "count" })}
                        />
                        After
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={form.repeat_count}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            repeat_count: e.target.value,
                            repeat_end_mode: "count",
                          })
                        }
                        className="h-7 w-16 text-right"
                      />
                      <span>occurrences</span>
                    </div>
                  </div>
                </div>
              )}

              {editingSession === null && form.repeat_mode !== "none" && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  All occurrences will be created at once with the same channel publication and capacity.
                </p>
              )}
            </div>
          )}

          {/* Capacity */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Capacity</p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input type="number" value={form.capacity} min="1"
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                <UsersIcon className="size-3 inline mr-1" />spots
              </span>
            </div>
            {form.service_id && (() => {
              const svc = services.find(s => s.id === form.service_id);
              return svc && parseInt(form.capacity) !== svc.capacity
                ? <p className="text-[10px] text-amber-600 mt-1">Service default: {svc.capacity} spots</p>
                : null;
            })()}
          </div>

          {/* Pricing — inherited from service, with optional override */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Pricing</p>
            {form.service_id ? (() => {
              const svc = services.find(s => s.id === form.service_id);
              return (
                <div className="space-y-3">
                  {/* Service price display */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <CoinsIcon className="size-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {form.override_pricing
                            ? formatMoneyWhole(form.price_mad, currency)
                            : svc
                              ? formatMoneyWhole(serviceDefaultPriceMad(svc), currency)
                              : "—"}
                        </p>
                        {!form.override_pricing && (
                          <p className="text-[10px] text-muted-foreground">Inherited from {svc?.name || "service"}</p>
                        )}
                        {form.override_pricing && svc && (
                          <p className="text-[10px] text-amber-600">
                            Service default: {formatMoneyWhole(serviceDefaultPriceMad(svc), currency)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Override</span>
                      <Switch
                        checked={form.override_pricing}
                        onCheckedChange={(checked) => {
                          const svc = services.find(s => s.id === form.service_id);
                          const serviceMad = serviceDefaultPriceMad(svc);
                          setForm({
                            ...form,
                            override_pricing: checked,
                            price_mad: checked ? form.price_mad : String(serviceMad || form.price_mad),
                          });
                        }}
                      />
                    </div>
                  </div>

                  {/* Override input */}
                  {form.override_pricing && (
                    <div>
                      <label className="text-xs text-muted-foreground">Custom price for this session ({currency})</label>
                      <Input type="number" className="mt-1" value={form.price_mad} min="0" step="0.01"
                        onChange={(e) => setForm({ ...form, price_mad: e.target.value })} />
                    </div>
                  )}
                </div>
              );
            })() : (
              <p className="text-xs text-muted-foreground">Select a service to see pricing</p>
            )}
          </div>

          {/* Publish to channels — Direct first, then Marketplace.
              Each row reflects the channel's studio-level state: live, off, or
              plan-gated. Off/locked rows are visually disabled and the toggle
              is forced OFF — prevents the studio from publishing to a channel
              they can't actually surface. */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Publish to
            </p>
            <div className="space-y-2">
              <PublishChannelRow
                label="Direct booking page"
                description="Visible on your studio's public booking page — paid at studio"
                state={channelState.direct}
                checked={form.publish_direct && channelState.direct === "live"}
                onCheckedChange={(checked) =>
                  setForm({ ...form, publish_direct: checked })
                }
                manageHref="/studio/channels/direct"
                upgradeHref="/studio/billing"
              />
              <PublishChannelRow
                label="Marketplace"
                description="Visible in the Moovli mobile app — paid via Moovli"
                state={channelState.marketplace}
                checked={form.publish_marketplace && channelState.marketplace === "live"}
                onCheckedChange={(checked) =>
                  setForm({ ...form, publish_marketplace: checked })
                }
                manageHref="/studio/channels/marketplace"
                upgradeHref="/studio/billing"
              />
            </div>
            {!form.publish_marketplace && !form.publish_direct && (
              <p className="text-[11px] text-amber-600 mt-2">
                ⚠ At least one channel should be selected, otherwise the session won&apos;t be visible to anyone.
              </p>
            )}
          </div>

          {/* Capacity allocation across channels */}
          {(form.publish_marketplace || form.publish_direct) && parseInt(form.capacity) > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Capacity allocation
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/40">
                  <input
                    type="radio"
                    name="allocation_mode"
                    checked={form.allocation_mode === "shared"}
                    onChange={() => setForm({ ...form, allocation_mode: "shared" })}
                    className="size-4"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Shared inventory</div>
                    <div className="text-[11px] text-muted-foreground">
                      Any channel can book any of the {form.capacity} spots
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/40">
                  <input
                    type="radio"
                    name="allocation_mode"
                    checked={form.allocation_mode === "split"}
                    onChange={() => setForm({ ...form, allocation_mode: "split" })}
                    className="size-4 mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div>
                      <div className="text-sm font-medium">Split per channel</div>
                      <div className="text-[11px] text-muted-foreground">
                        Reserve a fixed number of spots per channel
                      </div>
                    </div>
                    {form.allocation_mode === "split" && (() => {
                      // Anchored auto-balance: one channel is the "you set"
                      // value, the other absorbs the remainder. Sum is
                      // capacity by construction — never goes over or under.
                      const totalCapacity = parseInt(form.capacity) || 0;
                      const bothPublished = form.publish_direct && form.publish_marketplace;

                      // Default split when no anchor yet — half-and-half,
                      // direct gets the rounded-up half (it's the primary).
                      const defaultDirect = Math.ceil(totalCapacity / 2);
                      const defaultMarketplace = totalCapacity - defaultDirect;

                      const anchor = form.allocation_anchor;
                      const anchorValue =
                        anchor === "direct"
                          ? clampAlloc(form.allocation_direct, totalCapacity)
                          : anchor === "marketplace"
                            ? clampAlloc(form.allocation_marketplace, totalCapacity)
                            : null;

                      // Resolve effective per-channel allocations.
                      let directAlloc: number;
                      let marketplaceAlloc: number;
                      if (!bothPublished) {
                        // Only one channel published → it takes the full capacity.
                        directAlloc = form.publish_direct ? totalCapacity : 0;
                        marketplaceAlloc = form.publish_marketplace ? totalCapacity : 0;
                      } else if (anchor === "direct" && anchorValue != null) {
                        directAlloc = anchorValue;
                        marketplaceAlloc = totalCapacity - anchorValue;
                      } else if (anchor === "marketplace" && anchorValue != null) {
                        marketplaceAlloc = anchorValue;
                        directAlloc = totalCapacity - anchorValue;
                      } else {
                        directAlloc = defaultDirect;
                        marketplaceAlloc = defaultMarketplace;
                      }

                      const onAnchorChange = (
                        channel: "direct" | "marketplace",
                        raw: string,
                      ) => {
                        const v = clampAlloc(raw, totalCapacity);
                        setForm({
                          ...form,
                          allocation_anchor: channel,
                          allocation_direct:
                            channel === "direct"
                              ? String(v ?? "")
                              : String(totalCapacity - (v ?? 0)),
                          allocation_marketplace:
                            channel === "marketplace"
                              ? String(v ?? "")
                              : String(totalCapacity - (v ?? 0)),
                        });
                      };

                      const resetAnchor = () =>
                        setForm({
                          ...form,
                          allocation_anchor: null,
                          allocation_direct: "",
                          allocation_marketplace: "",
                        });

                      return (
                        <div className="space-y-2 pt-1">
                          {form.publish_direct && (
                            <AllocationRow
                              label="Direct booking page"
                              value={directAlloc}
                              max={totalCapacity}
                              isAnchor={anchor === "direct"}
                              autoFilled={bothPublished && anchor !== "direct"}
                              editable={bothPublished}
                              onChange={(raw) => onAnchorChange("direct", raw)}
                            />
                          )}
                          {form.publish_marketplace && (
                            <AllocationRow
                              label="Marketplace"
                              value={marketplaceAlloc}
                              max={totalCapacity}
                              isAnchor={anchor === "marketplace"}
                              autoFilled={bothPublished && anchor !== "marketplace"}
                              editable={bothPublished}
                              onChange={(raw) => onAnchorChange("marketplace", raw)}
                            />
                          )}
                          <div className="flex items-center justify-between gap-3 pt-1 border-t text-[11px]">
                            <span className="text-muted-foreground">
                              Allocated · {totalCapacity} total
                            </span>
                            {bothPublished && anchor && (
                              <button
                                type="button"
                                onClick={resetAnchor}
                                className="text-[10px] text-muted-foreground hover:text-foreground underline"
                              >
                                Reset to 50/50
                              </button>
                            )}
                          </div>

                          {/* Phase 2 — time-based release */}
                          <div className="pt-2 border-t space-y-2">
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={form.release_enabled}
                                onChange={(e) =>
                                  setForm({ ...form, release_enabled: e.target.checked })
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="size-3.5"
                              />
                              <span>Release unused spots to other channels</span>
                            </label>
                            {form.release_enabled && (
                              <div className="flex items-center gap-2 pl-5 text-xs">
                                <Input
                                  type="number"
                                  min="1"
                                  value={form.release_value}
                                  onChange={(e) =>
                                    setForm({ ...form, release_value: e.target.value })
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-7 w-16 text-right"
                                />
                                <select
                                  value={form.release_unit}
                                  onChange={(e) =>
                                    setForm({
                                      ...form,
                                      release_unit: e.target.value as
                                        | "minutes"
                                        | "hours"
                                        | "days",
                                    })
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-7 rounded border border-input bg-background px-2 text-xs"
                                >
                                  <option value="minutes">minutes</option>
                                  <option value="hours">hours</option>
                                  <option value="days">days</option>
                                </select>
                                <span className="text-muted-foreground">
                                  before session starts
                                </span>
                              </div>
                            )}
                            {form.release_enabled && (
                              <p className="text-[10px] text-muted-foreground pl-5">
                                At that point, unused spots from any channel
                                become bookable by the other.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs text-muted-foreground">Notes (optional)</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm min-h-[50px] focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Internal notes for this session..."
            />
          </div>

        </div>
      </FormSheet>
    </BaseLayout>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// ============================================================================
// ALLOCATION HELPERS — anchored auto-balance for the split-capacity UI.
// ============================================================================

/** Parse a raw input string and clamp into [0, max]. Empty → null. */
function clampAlloc(raw: string, max: number): number | null {
  if (raw === "" || raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(max, Math.floor(n)));
}

/**
 * One row in the split-capacity editor. Shows the channel's allocated seat
 * count plus a `you set` / `auto` chip so the studio knows which value they
 * own and which one was auto-computed.
 */
function AllocationRow({
  label,
  value,
  max,
  isAnchor,
  autoFilled,
  editable,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  isAnchor: boolean;
  autoFilled: boolean;
  editable: boolean;
  onChange: (raw: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs">{label}</span>
        {editable && isAnchor && (
          <span className="text-[9px] uppercase tracking-wider rounded bg-primary/10 px-1 py-0.5 text-primary">
            you set
          </span>
        )}
        {editable && autoFilled && (
          <span className="text-[9px] uppercase tracking-wider rounded bg-muted px-1 py-0.5 text-muted-foreground">
            auto
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min="0"
          max={max}
          value={value}
          disabled={!editable}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.preventDefault()}
          className="h-7 w-16 text-right"
        />
        <span className="text-[10px] text-muted-foreground tabular-nums">/ {max}</span>
      </div>
    </div>
  );
}

// ============================================================================
// PUBLISH ROW — one row per channel in the session form's "Publish to" block.
// State drives the visual + interaction: live = normal toggle; off = locked
// with "Enable" link to channel settings; locked = locked with "Upgrade" link.
// ============================================================================

function PublishChannelRow({
  label,
  description,
  state,
  checked,
  onCheckedChange,
  manageHref,
  upgradeHref,
}: {
  label: string;
  description: string;
  state: "live" | "off" | "locked";
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  manageHref: string;
  upgradeHref: string;
}) {
  const disabled = state !== "live";
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
        disabled ? "bg-muted/30" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
          <span>{label}</span>
          {state === "off" && (
            <span className="text-[10px] uppercase tracking-wider rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              Off in channel settings
            </span>
          )}
          {state === "locked" && (
            <span className="text-[10px] uppercase tracking-wider rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
              Plan upgrade required
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {state === "off" ? (
            <>
              Channel is off.{" "}
              <Link href={manageHref} className="underline hover:no-underline">
                Enable →
              </Link>
            </>
          ) : state === "locked" ? (
            <>
              Marketplace isn&apos;t in your current plan.{" "}
              <Link href={upgradeHref} className="underline hover:no-underline">
                Upgrade →
              </Link>
            </>
          ) : (
            description
          )}
        </div>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
