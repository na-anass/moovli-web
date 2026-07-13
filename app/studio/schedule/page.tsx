"use client";

import { BaseLayout } from "@/components/layout/base-layout";
import { type RowAction } from "@/components/shared/data-table";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { entityPlansApi } from "@/lib/api/entityPlans";
import { studioApi, type SessionScope } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import { formatMoneyWhole } from "@/lib/money";
import {
  formatTime,
  formatDate,
  formatDateCustom,
  localDateStr,
  localInputsToISO,
  toDateInput,
  toTimeInput,
  addMinutesToTime,
  minutesBetweenTimes,
} from "@/lib/datetime";
import Link from "next/link";
import {
  CalendarIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CoinsIcon,
  InfoIcon,
  ListIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
  UsersIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

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
  /** Shared id across a recurring series — enables scoped series actions. */
  recurrence_group_id?: string | null;
  /** Housekeeping visibility: null = active, timestamp = archived (hidden by default). */
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
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

const isPastSession = (s: { end_time: string }) => new Date(s.end_time) < new Date();

// ONE user-facing status per session, derived from the two underlying columns
// (`lifecycle_status` + `status`) plus time. Every surface — the list badge, the
// calendar card, and the filter dropdown — reads this, so the raw DB terms
// ("available" / "published") never reach the UI and can't confuse anyone.
type DisplayStatus = "draft" | "scheduled" | "full" | "cancelled" | "completed";

const displayStatus = (s: {
  lifecycle_status?: string;
  status: string;
  end_time: string;
}): DisplayStatus => {
  if ((s.lifecycle_status ?? "published") === "draft") return "draft";
  if (s.status === "cancelled") return "cancelled";
  if (isPastSession(s)) return "completed";
  if (s.status === "full") return "full";
  return "scheduled";
};

const DISPLAY_STATUS: Record<
  DisplayStatus,
  { bg: string; border: string; text: string }
> = {
  draft: { bg: "bg-muted", border: "border-l-gray-400 dark:border-l-gray-600", text: "text-muted-foreground" },
  scheduled: { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-l-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  full: { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-l-amber-500", text: "text-amber-700 dark:text-amber-300" },
  cancelled: { bg: "bg-red-50 dark:bg-red-950/40", border: "border-l-red-500", text: "text-red-700 dark:text-red-300 line-through opacity-70" },
  completed: { bg: "bg-gray-50 dark:bg-gray-900/40", border: "border-l-gray-400", text: "text-gray-500 dark:text-gray-400" },
};

// Kebab menu for a session card in the list view — mirrors the DataTable's row
// menu so both surfaces share the same `sessionRowActions` action list.
function SessionCardActions({ actions }: { actions: RowAction[] }) {
  const t = useTranslations("studioMain");
  if (!actions.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t("schedule.sessionActions")}>
          <MoreVerticalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, i) => {
          const Icon = action.icon;
          return (
            <div key={i}>
              {action.separatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant={action.variant}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {Icon && <Icon className="size-4" />}
                {action.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Sort presets for the list view (the card layout has no sortable headers).
const LIST_SORTS: { value: string; labelKey: string; key: "start_time" | "price_mad" | "booked_count" | "updated_at"; dir: "asc" | "desc" }[] = [
  { value: "start_time:asc", labelKey: "soonest", key: "start_time", dir: "asc" },
  { value: "start_time:desc", labelKey: "latest", key: "start_time", dir: "desc" },
  { value: "price_mad:desc", labelKey: "priceHighLow", key: "price_mad", dir: "desc" },
  { value: "booked_count:desc", labelKey: "mostBooked", key: "booked_count", dir: "desc" },
  { value: "updated_at:desc", labelKey: "recentlyUpdated", key: "updated_at", dir: "desc" },
];

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

// Google-Calendar overlap packing: assign each event in an overlapping cluster
// to the first column that is free at its start, so concurrent sessions render
// SIDE BY SIDE (each sized to its real duration) instead of stacked as lines.
const packColumns = <T extends { start_time: string; end_time: string }>(
  cluster: T[],
): { item: T; col: number; cols: number }[] => {
  const sorted = [...cluster].sort(
    (a, b) => a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time),
  );
  const colEnds: number[] = []; // end time (ms) of the last event placed in each column
  const placed = sorted.map((s) => {
    const start = new Date(s.start_time).getTime();
    const end = new Date(s.end_time).getTime();
    let col = colEnds.findIndex((e) => e <= start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(end);
    } else {
      colEnds[col] = end;
    }
    return { item: s, col };
  });
  const cols = colEnds.length || 1;
  return placed.map((p) => ({ ...p, cols }));
};

// Resolve the visual palette for a session: past sessions are always grayed out,
// otherwise we use the status palette.
const sessionColors = (s: { lifecycle_status?: string; end_time: string; status: string }) =>
  DISPLAY_STATUS[displayStatus(s)];

// ============================================================================
// HOURS CONFIG (for calendar time grid)
// ============================================================================

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 — 22:00
const HOUR_HEIGHT = 64; // px per hour

// Max side-by-side columns before overlapping sessions collapse into a "+N more"
// chip (Google-Calendar style) — keeps each block wide enough to stay readable.
const MAX_CALENDAR_COLS = 3;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SchedulePage() {
  const t = useTranslations("studioMain");
  const activeEntity = useActiveEntity();
  const currency = activeEntity.currencyCode;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  // List-view sort (default: soonest first).
  const [sortKey, setSortKey] = useState<"start_time" | "price_mad" | "booked_count" | "updated_at">("start_time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  // List view shows sessions as horizontal cards, revealed in batches of 3.
  const LIST_STEP = 3;
  const [listVisible, setListVisible] = useState(LIST_STEP);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("week");

  // Filters — applied client-side over the fetched window so all three views
  // stay in sync without refetching. Two clear axes, both derived from
  // displayStatus(): Visibility = is it public (draft vs published); Status =
  // the session's state (scheduled/full/cancelled/completed).
  type VisibilityFilter = "all" | "draft" | "published";
  type StateFilter = "all" | "scheduled" | "full" | "cancelled" | "completed";
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  // Free-text search over service + instructor name (shared across all views).
  const [search, setSearch] = useState("");

  // Google-Calendar-style detail popover — opened by clicking a session.
  const [detailSession, setDetailSession] = useState<Session | null>(null);
  // Overflow sessions collapsed behind a calendar "+N more" chip.
  const [moreSessions, setMoreSessions] = useState<Session[] | null>(null);
  // Id of the session currently being dragged to a new time slot (calendar).
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Recurring action scope prompt (Google-Calendar style). When set, a modal
  // asks whether the action applies to this event / this & following / all.
  const [scopePrompt, setScopePrompt] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    run: (scope: SessionScope) => void | Promise<void>;
  } | null>(null);
  const [scopeChoice, setScopeChoice] = useState<SessionScope>("single");
  const [scopeBusy, setScopeBusy] = useState(false);

  // Confirmation modal (replaces native confirm) for non-recurring destructive
  // actions, and a simple alert modal (replaces native alert) for errors.
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ title: string; description: string } | null>(null);
  const showAlert = (title: string, description: string) => setAlertMsg({ title, description });

  // Lightweight success/info toast — gives explicit confirmation after an action
  // so a saved draft never feels like "nothing happened". Auto-dismisses.
  const [toast, setToast] = useState<{ variant: "success" | "info"; message: string } | null>(null);
  const showToast = (message: string, variant: "success" | "info" = "success") =>
    setToast({ variant, message });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

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

  // The visible fetch window, derived from the current view + anchor date.
  // Fetching a bounded window (instead of "page 1 of everything") is what makes
  // newly created future sessions show up: the API orders by start_time asc, so
  // without a window a studio with 200+ sessions only ever gets its oldest 200
  // and never sees anything new. Day/week fetch their exact span; list fetches a
  // wide window centered on the anchor so the table still browses broadly.
  const [rangeFrom, rangeTo] = useMemo(() => {
    const anchor = new Date(calendarDate);
    anchor.setHours(0, 0, 0, 0);
    const from = new Date(anchor);
    const to = new Date(anchor);
    if (view === "day") {
      to.setDate(to.getDate() + 1);
    } else if (view === "week") {
      to.setDate(to.getDate() + 7);
    } else {
      // list: a generous window around the anchor.
      from.setMonth(from.getMonth() - 6);
      to.setMonth(to.getMonth() + 12);
    }
    return [from.toISOString(), to.toISOString()];
  }, [calendarDate, view]);

  const fetchSessions = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await studioApi.getSessions(entityId, {
        page: 1,
        limit: 200,
        date_from: rangeFrom,
        date_to: rangeTo,
      });
      setSessions(res.data);
      setTotal(res.pagination.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId, rangeFrom, rangeTo]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Apply the two filters + free-text search client-side (shared across all
  // views). Both filters read the same `displayStatus()` the badges show, so
  // "what you filter by" always equals "what the badge says".
  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (q) {
        const hay = `${s.service?.name ?? ""} ${s.provider?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const ds = displayStatus(s);
      // Visibility: draft (private) vs published (public — everything not draft).
      if (visibilityFilter === "draft" && ds !== "draft") return false;
      if (visibilityFilter === "published" && ds === "draft") return false;
      // Status: the session's state.
      if (stateFilter !== "all" && ds !== stateFilter) return false;
      return true;
    });
  }, [sessions, visibilityFilter, stateFilter, search]);

  // List view: sort the full filtered set, then slice to the current page.
  const sortedSessions = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (s: Session): string | number => {
      switch (sortKey) {
        case "price_mad": return s.price_mad ?? 0;
        case "booked_count": return s.booked_count;
        case "updated_at": return s.updated_at ?? "";
        default: return s.start_time;
      }
    };
    return [...filteredSessions].sort((a, b) => {
      const av = val(a), bv = val(b);
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [filteredSessions, sortKey, sortDir]);

  // List view slice: reveal the first few cards, then "Show more".
  const listSessions = useMemo(
    () => sortedSessions.slice(0, listVisible),
    [sortedSessions, listVisible],
  );

  // Collapse the list back to the first batch whenever the filter/sort inputs
  // change, so "Show more" always starts from the top of a fresh result set.
  useEffect(() => {
    setListVisible(LIST_STEP);
  }, [visibilityFilter, stateFilter, search, sortKey, sortDir]);

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
    const dateStr = localDateStr(d);
    const fmt = (mins: number) =>
      `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    const startStr = startMinutes != null ? fmt(startMinutes) : "";
    const fixedEnd = endMinutes != null ? fmt(endMinutes) : "";
    setForm({
      service_id: services[0]?.id || "",
      provider_id: "",
      date: dateStr,
      start_time: startStr,
      end_time: fixedEnd || (startStr && services[0] ? addMinutesToTime(startStr, services[0].duration_minutes) : ""),
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
    const svc = services.find((sv) => sv.id === s.service?.id);
    const serviceDefaultMad = serviceDefaultPriceMad(svc);
    const hasOverride = svc ? (s.price_mad || 0) !== serviceDefaultMad : false;
    setForm({
      service_id: s.service?.id || "",
      provider_id: s.provider?.id || "",
      date: toDateInput(s.start_time),
      start_time: toTimeInput(s.start_time),
      end_time: toTimeInput(s.end_time),
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
  // `scope` only matters when editing a recurring session.
  const handleSave = async (publish = false, scope: SessionScope = "single") => {
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
        start_time: localInputsToISO(form.date, form.start_time),
        end_time: localInputsToISO(form.date, form.end_time),
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
        await studioApi.updateSession(entityId, editingSession.id, payload, scope);
      } else {
        await studioApi.createSession(entityId, payload);
      }
      setDialogOpen(false);
      fetchSessions();
      if (editingSession) {
        showToast(t("schedule.toast.updated"));
      } else if (publish) {
        showToast(t("schedule.toast.published"));
      } else {
        showToast(t("schedule.toast.draftSaved"), "info");
      }
    } catch (e) {
      console.error(e);
      // Surface the failure instead of silently swallowing it — otherwise a
      // rejected create/update just looks like "nothing happened".
      showAlert(
        editingSession ? t("schedule.errors.saveTitle") : t("schedule.errors.createTitle"),
        (e as Error).message || t("schedule.errors.checkDetails"),
      );
    } finally {
      setSaving(false);
    }
  };

  // Run a lifecycle action with a recurring scope. For a one-off session, run
  // immediately as "single"; for a recurring one, open the scope picker first
  // (the modal doubles as the confirmation step).
  const withScope = (
    session: Session,
    opts: { title: string; description: string; confirmLabel: string; destructive?: boolean },
    run: (scope: SessionScope) => void | Promise<void>,
  ) => {
    if (session.recurrence_group_id) {
      // Recurring → the scope picker modal doubles as the confirmation.
      setScopeChoice("single");
      setScopePrompt({ ...opts, run });
    } else {
      // One-off → a plain confirmation modal.
      setConfirmDialog({
        title: opts.title,
        description: opts.description,
        confirmLabel: opts.confirmLabel,
        destructive: opts.destructive,
        onConfirm: () => run("single"),
      });
    }
  };

  // Hard delete. Backend allows this for drafts and for published sessions that
  // have NO bookings; published sessions with attendees must be cancelled instead.
  const handleDelete = (session: Session) => {
    const isDraft = (session.lifecycle_status ?? "published") === "draft";
    withScope(
      session,
      {
        title: isDraft ? t("schedule.delete.draftTitle") : t("schedule.delete.title"),
        description: isDraft
          ? t("schedule.delete.draftDesc")
          : t("schedule.delete.desc"),
        confirmLabel: t("schedule.delete.confirm"),
        destructive: true,
      },
      async (scope) => {
        if (!entityId) return;
        try {
          const res = await studioApi.deleteSession(entityId, session.id, scope);
          if (res.skipped_published > 0) {
            showAlert(t("schedule.delete.skippedTitle"), res.message);
          } else {
            showToast(t("schedule.toast.deleted"), "info");
          }
          fetchSessions();
        } catch (e) {
          console.error(e);
          showAlert(t("schedule.errors.deleteTitle"), (e as Error).message || t("schedule.errors.tryAgain"));
        }
      },
    );
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
      showToast(t("schedule.toast.published"));
    } catch (e) {
      console.error(e);
      showAlert(t("schedule.errors.publishTitle"), (e as Error).message || t("schedule.errors.tryAgain"));
    }
  };

  // Published → cancelled. Recurring sessions open the scope picker.
  const handleCancel = (session: Session) => {
    withScope(
      session,
      {
        title: t("schedule.cancel.title"),
        description: t("schedule.cancel.desc"),
        confirmLabel: t("schedule.cancel.confirm"),
        destructive: true,
      },
      async (scope) => {
        if (!entityId) return;
        try {
          await studioApi.cancelSession(entityId, session.id, scope);
          fetchSessions();
          showToast(t("schedule.toast.cancelled"), "info");
        } catch (e) {
          console.error(e);
          showAlert(t("schedule.errors.cancelTitle"), (e as Error).message || t("schedule.errors.tryAgain"));
        }
      },
    );
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    setForm((prev) => ({
      ...prev,
      service_id: serviceId,
      capacity: service ? String(service.capacity) : prev.capacity,
      price_mad: service ? String(serviceDefaultPriceMad(service)) : prev.price_mad,
      end_time: service && prev.start_time ? addMinutesToTime(prev.start_time, service.duration_minutes) : prev.end_time,
    }));
  };

  // Drag-and-drop reschedule: drop a session onto `day` at `startMinutes`
  // (minutes since local midnight). Keeps the original duration; recurring
  // sessions move just the dropped occurrence (scope "single").
  const rescheduleSession = async (session: Session, day: Date, startMinutes: number) => {
    if (!entityId) return;
    // Work in wall-clock minutes (the column is naive — never apply an offset).
    const durationMin = minutesBetweenTimes(toTimeInput(session.start_time), toTimeInput(session.end_time));
    const endMinutes = Math.min(startMinutes + durationMin, 24 * 60 - 1);
    const fmtMin = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const dateStr = localDateStr(day);
    // Nothing changed → skip the round-trip.
    if (dateStr === toDateInput(session.start_time) && fmtMin(startMinutes) === toTimeInput(session.start_time)) {
      return;
    }
    try {
      await studioApi.updateSession(
        entityId,
        session.id,
        {
          start_time: localInputsToISO(dateStr, fmtMin(startMinutes)),
          end_time: localInputsToISO(dateStr, fmtMin(endMinutes)),
        },
        "single",
      );
      fetchSessions();
    } catch (e) {
      console.error(e);
      showAlert(t("schedule.errors.moveTitle"), (e as Error).message || t("schedule.errors.tryAgain"));
    }
  };

  // ============================================================================
  // CALENDAR DATA
  // ============================================================================

  // Rolling 7-day window anchored on the selected day (today by default) — the
  // first column is the current/selected day and the next 6 follow it, so the
  // studio always looks forward instead of at past days of a Mon–Sun week.
  const weekStart = new Date(calendarDate);
  weekStart.setHours(0, 0, 0, 0);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const dayForView = view === "day" ? calendarDate : null;

  const getSessionsForDay = (day: Date) => {
    // Group by the session's LOCAL calendar day (start_time is a true UTC
    // instant; compare local dates so a session shows on the day the studio
    // sees it, consistent with how times render).
    const dayStr = localDateStr(day);
    return filteredSessions
      .filter((s) => localDateStr(new Date(s.start_time)) === dayStr)
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
      return formatDateCustom(calendarDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }
    return `${formatDateCustom(weekDays[0], { month: "short", day: "numeric" })} — ${formatDateCustom(weekDays[6], { month: "short", day: "numeric", year: "numeric" })}`;
  }, [calendarDate, view, weekDays]);

  // ============================================================================
  // LIST COLUMNS
  // ============================================================================

  // Lifecycle-aware row actions shared by the list view kebab. Follows the
  // session state machine: draft → edit/publish/delete; published active →
  // edit/cancel. Cancelled/completed sessions are read-only (no actions).
  const sessionRowActions = (s: Session): RowAction[] => {
    // Base actions on the DERIVED status (not raw `s.status`) so a past session
    // — which stays `status='available'` in the DB — is treated as completed
    // (read-only), matching its badge.
    const ds = displayStatus(s);
    const isDraft = ds === "draft";
    const isTerminal = ds === "cancelled" || ds === "completed";

    const actions: RowAction[] = [];
    if (!isTerminal) {
      actions.push({ label: t("schedule.rowActions.edit"), icon: PencilIcon, onClick: () => openEdit(s) });
    }

    if (isDraft) {
      actions.push({ label: t("schedule.rowActions.publish"), icon: SendIcon, onClick: () => handlePublish(s) });
      actions.push({
        label: s.recurrence_group_id ? t("schedule.rowActions.deleteEllipsis") : t("schedule.rowActions.delete"),
        icon: Trash2Icon,
        variant: "destructive",
        separatorBefore: true,
        onClick: () => handleDelete(s),
      });
    } else if (!isTerminal) {
      actions.push({
        label: s.recurrence_group_id ? t("schedule.rowActions.cancelEllipsis") : t("schedule.rowActions.cancelSession"),
        icon: XCircleIcon,
        variant: "destructive",
        separatorBefore: true,
        onClick: () => handleCancel(s),
      });
      // Unbooked published sessions carry no attendees, so they can be fully
      // removed (not just cancelled) — handy for cleaning up mistakes.
      if ((s.booked_count ?? 0) === 0) {
        actions.push({
          label: s.recurrence_group_id ? t("schedule.rowActions.deleteEllipsis") : t("schedule.rowActions.delete"),
          icon: Trash2Icon,
          variant: "destructive",
          onClick: () => handleDelete(s),
        });
      }
    }
    return actions;
  };

  // ============================================================================
  // RENDER: SESSION CARD (for calendar)
  // ============================================================================

  // Fills its positioned time block (Google-Calendar event). `compact` hides the
  // secondary detail rows when the block is short or the column is narrow.
  const SessionCard = ({
    session,
    compact,
  }: {
    session: Session;
    compact?: boolean;
  }) => {
    const colors = sessionColors(session);
    const isDraft = (session.lifecycle_status ?? "published") === "draft";
    // Stop the event reaching the day column's drag-to-create handlers —
    // otherwise clicking a card both opens the detail popover AND fires
    // "new session".
    const handlers = {
      onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        setDetailSession(session);
      },
    };
    // Drag-to-reschedule (calendar only) — disabled for read-only sessions.
    const canDrag = canManage && !["cancelled", "completed"].includes(displayStatus(session));
    const dragProps = canDrag
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", session.id);
            setDraggingId(session.id);
          },
          onDragEnd: () => setDraggingId(null),
        }
      : {};
    const dragClass = draggingId === session.id ? "opacity-40" : "";

    const name = session.service?.name || t("schedule.sessionFallback");
    const fill = `${session.booked_count}/${session.capacity}`;
    const isFull = session.capacity > 0 && session.booked_count >= session.capacity;
    // Full details live in the hover tooltip + click-through popover, so nothing
    // is lost when the block is too small to show it all.
    const tooltip = [
      name,
      `${formatTime(session.start_time)} — ${formatTime(session.end_time)}`,
      t("schedule.fillBooked", { fill }),
      session.provider?.name,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <button
        {...handlers}
        {...dragProps}
        title={tooltip}
        className={`flex h-full w-full flex-col overflow-hidden text-left rounded-md border-l-[3px] px-2 py-1 transition-all cursor-pointer ${colors.bg} ${colors.border} ${isDraft ? "border border-dashed" : ""} ${dragClass}`}
      >
        {/* Always: class name + fill count (the key studio metric). */}
        <div className="flex items-start justify-between gap-1">
          <p className={`min-w-0 flex-1 truncate text-xs font-medium ${colors.text}`}>
            {isDraft && <span className="font-semibold">{t("schedule.draftPrefix")} </span>}
            {name}
          </p>
          <span
            className={`flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums ${isFull ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
          >
            <UsersIcon className="size-2.5" />
            {fill}
          </span>
        </div>
        {/* When there's vertical room: time range, then instructor. */}
        {!compact && (
          <>
            <p className="text-[10px] text-muted-foreground">
              {formatTime(session.start_time)} — {formatTime(session.end_time)}
            </p>
            {session.provider?.name && (
              <p className="truncate text-[10px] text-muted-foreground">{session.provider.name}</p>
            )}
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
        className={`relative flex-1 min-w-0 ${!isOnly ? "border-r border-border last:border-r-0" : ""} ${canManage ? "cursor-cell select-none" : ""} ${draggingId ? "bg-primary/5" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        // Drag-and-drop reschedule: accept a dragged session at the drop time.
        onDragOver={(e) => {
          if (!draggingId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData("text/plain");
          const s = sessions.find((x) => x.id === id);
          setDraggingId(null);
          if (s) rescheduleSession(s, day, yToMinutes(e.clientY));
        }}
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

        {/* Sessions — a lone session fills its time block. Overlapping sessions
            are packed into side-by-side columns (Google-Calendar style): each is
            sized to its real start/end and takes an equal share of the column
            width, so concurrent classes sit next to each other instead of
            stacking. */}
        {clusterByOverlap(daySessions).flatMap((cluster) => {
          const placed = packColumns(cluster);
          const totalCols = placed[0]?.cols ?? 1;
          const overflow = totalCols > MAX_CALENDAR_COLS;
          // When crowded, the last visible column is reserved for the "+N more"
          // chip, so real events fill columns 0..(MAX-2).
          const renderCols = overflow ? MAX_CALENDAR_COLS : totalCols;
          const lastRealCol = overflow ? MAX_CALENDAR_COLS - 1 : totalCols;
          const widthPct = 100 / renderCols;

          const nodes = placed
            .filter((p) => p.col < lastRealCol)
            .map(({ item: s, col }) => {
              const { top, height } = getSessionPosition(s);
              const leftPct = col * widthPct;
              return (
                <div
                  key={s.id}
                  className="absolute z-[5]"
                  style={{
                    top,
                    height: Math.max(height - 2, 22),
                    left: `calc(${leftPct}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                  }}
                >
                  <SessionCard session={s} compact={height < 44 || renderCols > 2} />
                </div>
              );
            });

          if (overflow) {
            const hidden = placed.filter((p) => p.col >= lastRealCol).map((p) => p.item);
            const bounds = hidden.map(getSessionPosition);
            const top = Math.min(...bounds.map((b) => b.top));
            const bottom = Math.max(...bounds.map((b) => b.top + b.height));
            const leftPct = lastRealCol * widthPct;
            nodes.push(
              <button
                key={`more-${hidden[0].id}`}
                onClick={(e) => { e.stopPropagation(); setMoreSessions(hidden); }}
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute z-[5] flex items-center justify-center rounded-md border border-dashed border-border bg-muted/60 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted"
                style={{
                  top,
                  height: Math.max(bottom - top - 2, 22),
                  left: `calc(${leftPct}% + 2px)`,
                  width: `calc(${widthPct}% - 4px)`,
                }}
              >
                {t("schedule.plusMore", { count: hidden.length })}
              </button>,
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
      title={t("schedule.title")}
      subtitle={t("schedule.sessionCount", { count: total })}
      action={
        <>
          <div className="flex border border-border rounded-lg overflow-hidden">
            {(["day", "week", "list"] as ViewMode[]).map((v) => (
              <Button
                key={v}
                variant={view === v ? "secondary" : "ghost"}
                size="sm"
                className="rounded-none text-xs px-3"
                onClick={() => setView(v)}
              >
                {v === "list" ? <ListIcon className="size-3.5 mr-1" /> :
                  v === "day" ? <ClockIcon className="size-3.5 mr-1" /> :
                    <CalendarIcon className="size-3.5 mr-1" />}
                {t(`schedule.views.${v}`)}
              </Button>
            ))}
          </div>
          {canManage && (
            <Button onClick={() => openCreate()}>
              <PlusIcon className="size-4 mr-1.5" />
              {t("schedule.newSession")}
            </Button>
          )}
        </>
      }
    >
      {/* Filters — search + a single plain-language status + archived toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("schedule.searchPlaceholder")}
            className="h-8 pl-8 text-sm"
          />
        </div>
        {/* Visibility — is it public yet (draft vs published) */}
        <Select value={visibilityFilter} onValueChange={(v) => setVisibilityFilter(v as VisibilityFilter)}>
          <SelectTrigger size="sm" className="w-auto min-w-32">
            <SelectValue placeholder={t("schedule.filters.visibility")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("schedule.filters.allVisibility")}</SelectItem>
            <SelectItem value="draft">{t("schedule.filters.draft")}</SelectItem>
            <SelectItem value="published">{t("schedule.filters.published")}</SelectItem>
          </SelectContent>
        </Select>
        {/* Status — the session's state */}
        <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as StateFilter)}>
          <SelectTrigger size="sm" className="w-auto min-w-32">
            <SelectValue placeholder={t("schedule.filters.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("schedule.filters.allStatuses")}</SelectItem>
            <SelectItem value="scheduled">{t("schedule.displayStatus.scheduled")}</SelectItem>
            <SelectItem value="full">{t("schedule.displayStatus.full")}</SelectItem>
            <SelectItem value="cancelled">{t("schedule.displayStatus.cancelled")}</SelectItem>
            <SelectItem value="completed">{t("schedule.displayStatus.completed")}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {t("schedule.shownCount", { shown: filteredSessions.length, total: sessions.length })}
        </span>
      </div>

      {/* Calendar navigation */}
      {view !== "list" && (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={goToToday}>{t("schedule.today")}</Button>
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
                  <p className="text-[10px] text-muted-foreground uppercase">{formatDateCustom(day, { weekday: "short" })}</p>
                  <p className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>{day.getDate()}</p>
                  {daySessionCount > 0 && (
                    <p className="text-[10px] text-muted-foreground">{t("schedule.daySessionCount", { count: daySessionCount })}</p>
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

      {/* List View — horizontal cards, revealed 3 at a time */}
      {view === "list" && (
        <div className="space-y-3">
          {/* Sort control (the card layout has no sortable table headers) */}
          <div className="flex items-center justify-end">
            <Select
              value={`${sortKey}:${sortDir}`}
              onValueChange={(v) => {
                const preset = LIST_SORTS.find((s) => s.value === v);
                if (preset) {
                  setSortKey(preset.key);
                  setSortDir(preset.dir);
                }
              }}
            >
              <SelectTrigger size="sm" className="w-auto min-w-40">
                <SelectValue placeholder={t("schedule.sort.label")} />
              </SelectTrigger>
              <SelectContent>
                {LIST_SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{t(`schedule.sort.${s.labelKey}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="rounded-xl border bg-card py-12 text-center text-sm text-muted-foreground">
              {t("schedule.loading")}
            </div>
          ) : listSessions.length === 0 ? (
            <div className="rounded-xl border bg-card py-12 text-center text-sm text-muted-foreground">
              {t("schedule.noMatch")}
            </div>
          ) : (
            <>
              {listSessions.map((s) => {
                const ds = DISPLAY_STATUS[displayStatus(s)];
                const dsLabel = t(`schedule.displayStatus.${displayStatus(s)}`);
                const actions = canManage ? sessionRowActions(s) : [];
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-4 rounded-xl border border-l-4 bg-card p-4 ${ds.border}`}
                  >
                    <div className="min-w-0 flex-1">
                      <button
                        className="block truncate text-left font-semibold hover:underline"
                        onClick={() => setDetailSession(s)}
                      >
                        {s.service?.name || t("schedule.notAvailable")}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarIcon className="size-3.5" /> {formatDate(s.start_time)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ClockIcon className="size-3.5" /> {formatTime(s.start_time)} — {formatTime(s.end_time)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UsersIcon className="size-3.5" /> {s.booked_count}/{s.capacity}
                          {s.waitlist_count > 0 ? ` ${t("schedule.waitlistShort", { count: s.waitlist_count })}` : ""}
                        </span>
                        {s.provider?.name && <span>{s.provider.name}</span>}
                        {s.price_mad != null && (
                          <span className="inline-flex items-center gap-1">
                            <CoinsIcon className="size-3.5" /> {formatMoneyWhole(s.price_mad, currency)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`${ds.bg} ${ds.text} shrink-0`}>
                      {dsLabel}
                    </Badge>
                    <SessionCardActions actions={actions} />
                  </div>
                );
              })}

              {listVisible < sortedSessions.length && (
                <div className="flex justify-center pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setListVisible((n) => n + LIST_STEP)}
                  >
                    {t("schedule.showMore", { count: sortedSessions.length - listVisible })}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create / Edit sheet */}
      <FormSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingSession ? t("schedule.form.editTitle") : t("schedule.form.newTitle")}
        subtitle={
          editingSession
            ? t("schedule.form.editSubtitle")
            : t("schedule.form.newSubtitle")
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
                    <Trash2Icon className="size-3.5 mr-1.5" /> {t("schedule.form.deleteDraft")}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mr-auto text-destructive hover:text-destructive"
                    onClick={() => { handleCancel(editingSession); setDialogOpen(false); }}
                  >
                    <XCircleIcon className="size-3.5 mr-1.5" /> {t("schedule.form.cancelSession")}
                  </Button>
                )
              )}
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                {t("schedule.form.close")}
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
                      <SendIcon className="size-4 mr-1.5" /> {t("schedule.form.publish")}
                    </Button>
                  )}
                  <Button
                    onClick={() =>
                      editingSession.recurrence_group_id
                        ? withScope(
                            editingSession,
                            {
                              title: t("schedule.form.updateTitle"),
                              description: t("schedule.form.applyChangesTo"),
                              confirmLabel: t("schedule.form.update"),
                            },
                            (scope) => handleSave(false, scope),
                          )
                        : handleSave(false)
                    }
                    disabled={formInvalid}
                  >
                    {saving ? t("schedule.form.saving") : t("schedule.form.update")}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => handleSave(false)} disabled={formInvalid}>
                    {saving ? t("schedule.form.saving") : t("schedule.form.saveAsDraft")}
                  </Button>
                  <Button onClick={() => handleSave(true)} disabled={formInvalid}>
                    {saving ? (
                      form.repeat_mode !== "none" ? t("schedule.form.creatingSessions") : t("schedule.form.publishing")
                    ) : (
                      <><SendIcon className="size-4 mr-1.5" /> {t("schedule.form.publish")}</>
                    )}
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
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("schedule.form.what")}</p>
            <Select value={form.service_id} onValueChange={handleServiceChange}>
              <SelectTrigger><SelectValue placeholder={t("schedule.form.selectService")} /></SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <span>{s.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {t("schedule.form.serviceMeta", { duration: s.duration_minutes, price: formatMoneyWhole(serviceDefaultPriceMad(s), currency), capacity: s.capacity })}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Who — instructor */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("schedule.form.whoTeaches")}</p>
            <Select value={form.provider_id || "none"} onValueChange={(v) => setForm({ ...form, provider_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("schedule.form.noInstructor")}</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.tier ? ` · ${p.tier}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* When — date + time */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("schedule.form.when")}</p>
            <div className="space-y-3">
              <Input type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">{t("schedule.form.startTime")}</label>
                  <Input type="time" className="mt-1" value={form.start_time}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      const service = services.find((s) => s.id === form.service_id);
                      setForm({ ...form, start_time: newStart, end_time: service ? addMinutesToTime(newStart, service.duration_minutes) : form.end_time });
                    }} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t("schedule.form.endTime")}</label>
                  <Input type="time" className="mt-1" value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>
              {form.start_time && form.end_time && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ClockIcon className="size-3" />
                  {t("schedule.form.duration", { min: minutesBetweenTimes(form.start_time, form.end_time) })}
                  {form.service_id && (() => {
                    const svc = services.find(s => s.id === form.service_id);
                    const dur = minutesBetweenTimes(form.start_time, form.end_time);
                    return svc && dur !== svc.duration_minutes
                      ? <span className="text-amber-600 ml-1">{t("schedule.form.serviceDefaultDuration", { min: svc.duration_minutes })}</span>
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
                {t("schedule.form.repeats")}
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
                  <SelectItem value="none">{t("schedule.form.doesntRepeat")}</SelectItem>
                  <SelectItem value="daily">{t("schedule.form.daily")}</SelectItem>
                  <SelectItem value="weekly">{t("schedule.form.weekly")}</SelectItem>
                </SelectContent>
              </Select>

              {form.repeat_mode !== "none" && (
                <div className="mt-3 space-y-3 rounded-lg border p-3 bg-muted/30">
                  {/* Interval */}
                  <div className="flex items-center gap-2 text-xs">
                    <span>{t("schedule.form.every")}</span>
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
                        ? t("schedule.form.dayUnit", { count: parseInt(form.repeat_interval) || 0 })
                        : t("schedule.form.weekUnit", { count: parseInt(form.repeat_interval) || 0 })}
                    </span>
                  </div>

                  {/* Weekday selector (weekly only) */}
                  {form.repeat_mode === "weekly" && (
                    <div className="space-y-1.5">
                      <div className="text-xs text-muted-foreground">{t("schedule.form.onTheseDays")}</div>
                      <div className="flex gap-1">
                        {([
                          { id: "mon", label: t("schedule.form.weekday.mon") },
                          { id: "tue", label: t("schedule.form.weekday.tue") },
                          { id: "wed", label: t("schedule.form.weekday.wed") },
                          { id: "thu", label: t("schedule.form.weekday.thu") },
                          { id: "fri", label: t("schedule.form.weekday.fri") },
                          { id: "sat", label: t("schedule.form.weekday.sat") },
                          { id: "sun", label: t("schedule.form.weekday.sun") },
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
                        {t("schedule.form.weekdayHint")}
                      </p>
                    </div>
                  )}

                  {/* End condition */}
                  <div className="space-y-1.5">
                    <div className="text-xs text-muted-foreground">{t("schedule.form.ends")}</div>
                    <div className="flex items-center gap-2 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="repeat_end_mode"
                          checked={form.repeat_end_mode === "until"}
                          onChange={() => setForm({ ...form, repeat_end_mode: "until" })}
                        />
                        {t("schedule.form.endsOn")}
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
                        {t("schedule.form.endsAfter")}
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
                      <span>{t("schedule.form.occurrences")}</span>
                    </div>
                  </div>
                </div>
              )}

              {editingSession === null && form.repeat_mode !== "none" && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  {t("schedule.form.allOccurrencesNote")}
                </p>
              )}
            </div>
          )}

          {/* Capacity */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("schedule.form.capacity")}</p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input type="number" value={form.capacity} min="1"
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                <UsersIcon className="size-3 inline mr-1" />{t("schedule.form.spots")}
              </span>
            </div>
            {form.service_id && (() => {
              const svc = services.find(s => s.id === form.service_id);
              return svc && parseInt(form.capacity) !== svc.capacity
                ? <p className="text-[10px] text-amber-600 mt-1">{t("schedule.form.serviceDefaultCapacity", { count: svc.capacity })}</p>
                : null;
            })()}
          </div>

          {/* Pricing — inherited from service, with optional override */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("schedule.form.pricing")}</p>
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
                          <p className="text-[10px] text-muted-foreground">{t("schedule.form.inheritedFrom", { name: svc?.name || t("schedule.form.serviceWord") })}</p>
                        )}
                        {form.override_pricing && svc && (
                          <p className="text-[10px] text-amber-600">
                            {t("schedule.form.serviceDefaultPrice", { price: formatMoneyWhole(serviceDefaultPriceMad(svc), currency) })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{t("schedule.form.override")}</span>
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
                      <label className="text-xs text-muted-foreground">{t("schedule.form.customPrice", { currency })}</label>
                      <Input type="number" className="mt-1" value={form.price_mad} min="0" step="0.01"
                        onChange={(e) => setForm({ ...form, price_mad: e.target.value })} />
                    </div>
                  )}
                </div>
              );
            })() : (
              <p className="text-xs text-muted-foreground">{t("schedule.form.selectServicePricing")}</p>
            )}
          </div>

          {/* Publish to channels — Direct first, then Marketplace.
              Each row reflects the channel's studio-level state: live, off, or
              plan-gated. Off/locked rows are visually disabled and the toggle
              is forced OFF — prevents the studio from publishing to a channel
              they can't actually surface. */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {t("schedule.form.publishTo")}
            </p>
            <div className="space-y-2">
              <PublishChannelRow
                label={t("schedule.form.directLabel")}
                description={t("schedule.form.directDesc")}
                state={channelState.direct}
                checked={form.publish_direct && channelState.direct === "live"}
                onCheckedChange={(checked) =>
                  setForm({ ...form, publish_direct: checked })
                }
                manageHref="/studio/channels/direct"
                upgradeHref="/studio/billing"
                offBadge={t("schedule.form.offInSettings")}
                lockedBadge={t("schedule.form.planUpgrade")}
                offText={t("schedule.form.channelOff")}
                enableLink={t("schedule.form.enable")}
                lockedText={t("schedule.form.notInPlan")}
                upgradeLink={t("schedule.form.upgrade")}
              />
              <PublishChannelRow
                label={t("schedule.form.marketplaceLabel")}
                description={t("schedule.form.marketplaceDesc")}
                state={channelState.marketplace}
                checked={form.publish_marketplace && channelState.marketplace === "live"}
                onCheckedChange={(checked) =>
                  setForm({ ...form, publish_marketplace: checked })
                }
                manageHref="/studio/channels/marketplace"
                upgradeHref="/studio/billing"
                offBadge={t("schedule.form.offInSettings")}
                lockedBadge={t("schedule.form.planUpgrade")}
                offText={t("schedule.form.channelOff")}
                enableLink={t("schedule.form.enable")}
                lockedText={t("schedule.form.notInPlan")}
                upgradeLink={t("schedule.form.upgrade")}
              />
            </div>
            {!form.publish_marketplace && !form.publish_direct && (
              <p className="text-[11px] text-amber-600 mt-2">
                {t("schedule.form.noChannelWarning")}
              </p>
            )}
          </div>

          {/* Capacity allocation across channels */}
          {(form.publish_marketplace || form.publish_direct) && parseInt(form.capacity) > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {t("schedule.form.capacityAllocation")}
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
                    <div className="text-sm font-medium">{t("schedule.form.sharedInventory")}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t("schedule.form.sharedInventoryDesc", { capacity: form.capacity })}
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
                      <div className="text-sm font-medium">{t("schedule.form.splitPerChannel")}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {t("schedule.form.splitPerChannelDesc")}
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
                              label={t("schedule.form.directLabel")}
                              value={directAlloc}
                              max={totalCapacity}
                              isAnchor={anchor === "direct"}
                              autoFilled={bothPublished && anchor !== "direct"}
                              editable={bothPublished}
                              onChange={(raw) => onAnchorChange("direct", raw)}
                              youSetLabel={t("schedule.form.youSet")}
                              autoLabel={t("schedule.form.auto")}
                            />
                          )}
                          {form.publish_marketplace && (
                            <AllocationRow
                              label={t("schedule.form.marketplaceLabel")}
                              value={marketplaceAlloc}
                              max={totalCapacity}
                              isAnchor={anchor === "marketplace"}
                              autoFilled={bothPublished && anchor !== "marketplace"}
                              editable={bothPublished}
                              onChange={(raw) => onAnchorChange("marketplace", raw)}
                              youSetLabel={t("schedule.form.youSet")}
                              autoLabel={t("schedule.form.auto")}
                            />
                          )}
                          <div className="flex items-center justify-between gap-3 pt-1 border-t text-[11px]">
                            <span className="text-muted-foreground">
                              {t("schedule.form.allocatedTotal", { total: totalCapacity })}
                            </span>
                            {bothPublished && anchor && (
                              <button
                                type="button"
                                onClick={resetAnchor}
                                className="text-[10px] text-muted-foreground hover:text-foreground underline"
                              >
                                {t("schedule.form.reset5050")}
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
                              <span>{t("schedule.form.releaseUnused")}</span>
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
                                  <option value="minutes">{t("schedule.form.unitMinutes")}</option>
                                  <option value="hours">{t("schedule.form.unitHours")}</option>
                                  <option value="days">{t("schedule.form.unitDays")}</option>
                                </select>
                                <span className="text-muted-foreground">
                                  {t("schedule.form.beforeSession")}
                                </span>
                              </div>
                            )}
                            {form.release_enabled && (
                              <p className="text-[10px] text-muted-foreground pl-5">
                                {t("schedule.form.releaseHint")}
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
            <label className="text-xs text-muted-foreground">{t("schedule.form.notes")}</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm min-h-[50px] focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t("schedule.form.notesPlaceholder")}
            />
          </div>

        </div>
      </FormSheet>

      {/* Recurring action scope picker (Google-Calendar style) */}
      <Dialog open={!!scopePrompt} onOpenChange={(open) => { if (!open) setScopePrompt(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{scopePrompt?.title}</DialogTitle>
            <DialogDescription>{scopePrompt?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {([
              { value: "single", label: t("schedule.scope.single") },
              { value: "following", label: t("schedule.scope.following") },
              { value: "series", label: t("schedule.scope.series") },
            ] as const).map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/40"
              >
                <input
                  type="radio"
                  name="recurring_scope"
                  className="size-4"
                  checked={scopeChoice === opt.value}
                  onChange={() => setScopeChoice(opt.value)}
                />
                <span className="text-sm font-medium">{opt.label}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScopePrompt(null)} disabled={scopeBusy}>
              {t("schedule.form.close")}
            </Button>
            <Button
              variant={scopePrompt?.destructive ? "destructive" : "default"}
              disabled={scopeBusy}
              onClick={async () => {
                if (!scopePrompt) return;
                setScopeBusy(true);
                try {
                  await scopePrompt.run(scopeChoice);
                } finally {
                  setScopeBusy(false);
                  setScopePrompt(null);
                }
              }}
            >
              {scopeBusy ? t("schedule.working") : scopePrompt?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session detail popover (Google-Calendar style) — opened by clicking a
          session card; shows the key details + lifecycle-aware actions. */}
      <Dialog open={!!detailSession} onOpenChange={(open) => { if (!open) setDetailSession(null); }}>
        <DialogContent className="sm:max-w-md">
          {detailSession && (() => {
            const s = detailSession;
            const ds = DISPLAY_STATUS[displayStatus(s)];
            const dsLabel = t(`schedule.displayStatus.${displayStatus(s)}`);
            const isDraft = displayStatus(s) === "draft";
            const isTerminal = ["cancelled", "completed"].includes(displayStatus(s));
            const close = () => setDetailSession(null);
            const run = (fn: (s: Session) => void) => { close(); fn(s); };
            return (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between gap-3">
                    <DialogTitle className="text-base">{s.service?.name || t("schedule.sessionFallback")}</DialogTitle>
                    <Badge variant="outline" className={`${ds.bg} ${ds.text} shrink-0`}>{dsLabel}</Badge>
                  </div>
                  <DialogDescription className="sr-only">{t("schedule.detail.srTitle")}</DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-1 text-sm">
                  <div className="flex items-start gap-2.5">
                    <CalendarIcon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p>{formatDateCustom(s.start_time, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatTime(s.start_time)} — {formatTime(s.end_time)} · {minutesBetweenTimes(toTimeInput(s.start_time), toTimeInput(s.end_time))} min
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <UsersIcon className="size-4 text-muted-foreground shrink-0" />
                    <span>
                      {s.provider?.name || t("schedule.form.noInstructor")}
                      {s.provider?.tier ? ` · ${s.provider.tier}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <UsersIcon className="size-4 text-muted-foreground shrink-0" />
                    <span>
                      {t("schedule.detail.booked", { booked: s.booked_count, capacity: s.capacity })}
                      {s.waitlist_count > 0 ? ` · ${t("schedule.detail.waitlisted", { count: s.waitlist_count })}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CoinsIcon className="size-4 text-muted-foreground shrink-0" />
                    <span>{s.price_mad != null ? formatMoneyWhole(s.price_mad, currency) : "—"}</span>
                  </div>
                  {s.is_recurring && (
                    <div className="flex items-center gap-2.5">
                      <ClockIcon className="size-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{t("schedule.detail.recurringSeries")}</span>
                    </div>
                  )}
                  {s.notes && (
                    <p className="text-xs text-muted-foreground border-t pt-2 whitespace-pre-wrap">{s.notes}</p>
                  )}
                </div>

                <DialogFooter>
                  {canManage && isDraft && (
                    <Button variant="ghost" size="sm" className="mr-auto text-destructive hover:text-destructive" onClick={() => run(handleDelete)}>
                      <Trash2Icon className="size-3.5 mr-1.5" /> {t("schedule.rowActions.delete")}
                    </Button>
                  )}
                  {canManage && !isDraft && !isTerminal && (
                    <Button variant="ghost" size="sm" className="mr-auto text-destructive hover:text-destructive" onClick={() => run(handleCancel)}>
                      <XCircleIcon className="size-3.5 mr-1.5" /> {t("schedule.detail.cancel")}
                    </Button>
                  )}
                  <Button variant="ghost" onClick={close}>{t("schedule.form.close")}</Button>
                  {canManage && isDraft && (
                    <Button variant="outline" onClick={() => run(handlePublish)}>
                      <SendIcon className="size-4 mr-1.5" /> {t("schedule.form.publish")}
                    </Button>
                  )}
                  {canManage && !isTerminal && (
                    <Button onClick={() => run(openEdit)}>
                      <PencilIcon className="size-4 mr-1.5" /> {t("schedule.rowActions.edit")}
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* "+N more" overflow — sessions collapsed from a crowded calendar slot */}
      <Dialog open={!!moreSessions} onOpenChange={(open) => { if (!open) setMoreSessions(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{t("schedule.more.title")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("schedule.more.srDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {(moreSessions ?? [])
              .slice()
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
              .map((s) => {
                const ds = DISPLAY_STATUS[displayStatus(s)];
                const dsLabel = t(`schedule.displayStatus.${displayStatus(s)}`);
                return (
                  <button
                    key={s.id}
                    onClick={() => { setMoreSessions(null); setDetailSession(s); }}
                    className={`flex w-full items-center gap-3 rounded-lg border border-l-4 bg-card p-3 text-left transition-colors hover:bg-muted/50 ${ds.border}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.service?.name || t("schedule.sessionFallback")}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(s.start_time)} — {formatTime(s.end_time)}
                        {s.provider?.name ? ` · ${s.provider.name}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {s.booked_count}/{s.capacity}
                    </span>
                    <Badge variant="outline" className={`${ds.bg} ${ds.text} shrink-0`}>{dsLabel}</Badge>
                  </button>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation modal (replaces native confirm) for one-off actions */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
            <DialogDescription>{confirmDialog?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialog(null)} disabled={confirmBusy}>
              {t("schedule.form.close")}
            </Button>
            <Button
              variant={confirmDialog?.destructive ? "destructive" : "default"}
              disabled={confirmBusy}
              onClick={async () => {
                if (!confirmDialog) return;
                setConfirmBusy(true);
                try {
                  await confirmDialog.onConfirm();
                } finally {
                  setConfirmBusy(false);
                  setConfirmDialog(null);
                }
              }}
            >
              {confirmBusy ? t("schedule.working") : confirmDialog?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert modal (replaces native alert) for errors / notices */}
      <Dialog open={!!alertMsg} onOpenChange={(open) => { if (!open) setAlertMsg(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{alertMsg?.title}</DialogTitle>
            <DialogDescription>{alertMsg?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setAlertMsg(null)}>{t("schedule.ok")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success/info toast — explicit confirmation after an action. */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
          {toast.variant === "success" ? (
            <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-green-600 dark:text-green-500" />
          ) : (
            <InfoIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          )}
          <p className="text-sm text-foreground">{toast.message}</p>
          <button
            onClick={() => setToast(null)}
            className="ml-1 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={t("schedule.dismiss")}
          >
            <XIcon className="size-4" />
          </button>
        </div>
      )}
    </BaseLayout>
  );
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
  youSetLabel,
  autoLabel,
}: {
  label: string;
  value: number;
  max: number;
  isAnchor: boolean;
  autoFilled: boolean;
  editable: boolean;
  onChange: (raw: string) => void;
  youSetLabel: string;
  autoLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs">{label}</span>
        {editable && isAnchor && (
          <span className="text-[9px] uppercase tracking-wider rounded bg-primary/10 px-1 py-0.5 text-primary">
            {youSetLabel}
          </span>
        )}
        {editable && autoFilled && (
          <span className="text-[9px] uppercase tracking-wider rounded bg-muted px-1 py-0.5 text-muted-foreground">
            {autoLabel}
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
  offBadge,
  lockedBadge,
  offText,
  enableLink,
  lockedText,
  upgradeLink,
}: {
  label: string;
  description: string;
  state: "live" | "off" | "locked";
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  manageHref: string;
  upgradeHref: string;
  offBadge: string;
  lockedBadge: string;
  offText: string;
  enableLink: string;
  lockedText: string;
  upgradeLink: string;
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
              {offBadge}
            </span>
          )}
          {state === "locked" && (
            <span className="text-[10px] uppercase tracking-wider rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
              {lockedBadge}
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {state === "off" ? (
            <>
              {offText}{" "}
              <Link href={manageHref} className="underline hover:no-underline">
                {enableLink}
              </Link>
            </>
          ) : state === "locked" ? (
            <>
              {lockedText}{" "}
              <Link href={upgradeHref} className="underline hover:no-underline">
                {upgradeLink}
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
