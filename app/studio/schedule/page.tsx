"use client";

import { BaseLayout } from "@/components/layout/base-layout";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CoinsIcon,
  ListIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

// ============================================================================
// HOURS CONFIG (for calendar time grid)
// ============================================================================

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 — 22:00
const HOUR_HEIGHT = 64; // px per hour

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SchedulePage() {
  const { roles } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("week");

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
  });

  const entityId = roles?.ownedEntities?.[0]?.entityId;
  const currentRole = roles?.ownedEntities?.[0]?.role;
  const canManage = currentRole === "manager" || currentRole === "owner" || roles?.isAdmin;

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

  // ============================================================================
  // FORM ACTIONS
  // ============================================================================

  const openCreate = (date?: Date, hour?: number, minute: number = 0) => {
    setEditingSession(null);
    const d = date || new Date();
    const dateStr = d.toISOString().split("T")[0];
    const startStr =
      hour != null
        ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
        : "";
    setForm({
      service_id: services[0]?.id || "",
      provider_id: "",
      date: dateStr,
      start_time: startStr,
      end_time: startStr && services[0] ? addMinutes(startStr, services[0].duration_minutes) : "",
      capacity: services[0] ? String(services[0].capacity) : "12",
      price_mad: services[0] ? String(serviceDefaultPriceMad(services[0])) : "50",
      notes: "",
      is_recurring: false,
      override_pricing: false,
      publish_marketplace: true,
      publish_direct: true,
      allocation_mode: "shared",
      allocation_marketplace: "",
      allocation_direct: "",
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
      publish_marketplace: true,
      publish_direct: true,
      allocation_mode: "shared",
      allocation_marketplace: "",
      allocation_direct: "",
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

  const handleSave = async () => {
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

      // Only send channel_allocations when in split mode AND the channel is selected
      const channelAllocations: Record<string, number> | undefined =
        form.allocation_mode === "split"
          ? Object.fromEntries(
              [
                form.publish_marketplace && form.allocation_marketplace
                  ? ["marketplace", parseInt(form.allocation_marketplace)]
                  : null,
                form.publish_direct && form.allocation_direct
                  ? ["direct_hosted", parseInt(form.allocation_direct)]
                  : null,
              ].filter(Boolean) as Array<[string, number]>,
            )
          : undefined;

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

  const handleDelete = async (sessionId: string) => {
    if (!entityId || !confirm("Cancel this session?")) return;
    try {
      await studioApi.deleteSession(entityId, sessionId);
      fetchSessions();
    } catch (e) {
      console.error(e);
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
    return sessions
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
    { header: "Price", cell: (r) => <span>{r.price_mad != null ? `${r.price_mad} MAD` : "—"}</span> },
    {
      header: "Status",
      cell: (r) => (
        <Badge variant="outline" className={`${STATUS_COLORS[r.status]?.bg || ""} ${STATUS_COLORS[r.status]?.text || ""}`}>
          {r.status}
        </Badge>
      ),
    },
    ...(canManage ? [{
      header: "",
      cell: (r: Session) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(r)}><PencilIcon className="size-3" /></Button>
          <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => handleDelete(r.id)}><Trash2Icon className="size-3" /></Button>
        </div>
      ),
    }] : []),
  ];

  // ============================================================================
  // RENDER: SESSION CARD (for calendar)
  // ============================================================================

  const SessionCard = ({ session, compact }: { session: Session; compact?: boolean }) => {
    const colors = STATUS_COLORS[session.status] || STATUS_COLORS.available;
    return (
      <button
        onClick={() => canManage ? openEdit(session) : undefined}
        className={`w-full text-left rounded-md border-l-[3px] px-2 py-1 transition-all hover:shadow-sm ${colors.bg} ${colors.border} ${canManage ? "cursor-pointer" : ""}`}
      >
        <p className={`text-xs font-medium truncate ${colors.text}`}>
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

    return (
      <div className={`relative flex-1 min-w-0 ${!isOnly ? "border-r border-border last:border-r-0" : ""}`}>
        {/* Hour cells — full-height clickable regions à la Google Calendar.
            Top half = X:00 click target, bottom half = X:30. */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute w-full border-t border-border/50"
            style={{ top: (h - 6) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
          >
            {canManage && (
              <>
                <button
                  type="button"
                  aria-label={`Create session at ${String(h).padStart(2, "0")}:00`}
                  className="absolute inset-x-0 top-0 h-1/2 cursor-pointer hover:bg-accent/40 focus:bg-accent/40 focus:outline-none transition-colors"
                  onClick={() => openCreate(day, h)}
                />
                <button
                  type="button"
                  aria-label={`Create session at ${String(h).padStart(2, "0")}:30`}
                  className="absolute inset-x-0 bottom-0 h-1/2 border-t border-dashed border-border/30 cursor-pointer hover:bg-accent/40 focus:bg-accent/40 focus:outline-none transition-colors"
                  onClick={() => openCreate(day, h, 30)}
                />
              </>
            )}
          </div>
        ))}

        {/* Current time line */}
        {nowTop > 0 && (
          <div className="absolute left-0 right-0 z-10 flex items-center" style={{ top: nowTop }}>
            <div className="size-2 rounded-full bg-primary -ml-1" />
            <div className="flex-1 h-px bg-primary" />
          </div>
        )}

        {/* Sessions */}
        {daySessions.map((s) => {
          const { top, height } = getSessionPosition(s);
          return (
            <div
              key={s.id}
              className="absolute left-1 right-1 z-[5]"
              style={{ top, height: Math.max(height - 2, 22) }}
            >
              <SessionCard session={s} compact={height < 40} />
            </div>
          );
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
          data={sessions}
          total={total}
          page={page}
          pageSize={50}
          onPageChange={setPage}
          isLoading={loading}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSession ? "Edit Session" : "New Session"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2 max-h-[70vh] overflow-y-auto pr-1">
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
                          {s.duration_minutes}min · {serviceDefaultPriceMad(s)} MAD · {s.capacity} spots
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
                    <SelectItem value="none">Doesn't repeat</SelectItem>
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
                                className={`size-8 rounded-full text-xs font-medium border transition ${
                                  on
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
                          Leave empty to use the start date's weekday only.
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
                              ? form.price_mad
                              : svc ? serviceDefaultPriceMad(svc) : "—"} MAD
                          </p>
                          {!form.override_pricing && (
                            <p className="text-[10px] text-muted-foreground">Inherited from {svc?.name || "service"}</p>
                          )}
                          {form.override_pricing && svc && (
                            <p className="text-[10px] text-amber-600">
                              Service default: {serviceDefaultPriceMad(svc)} MAD
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
                        <label className="text-xs text-muted-foreground">Custom price for this session (MAD)</label>
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

            {/* Publish to channels */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Publish to
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Marketplace</div>
                    <div className="text-[11px] text-muted-foreground">
                      Visible in the Moovli mobile app — paid via Moovli
                    </div>
                  </div>
                  <Switch
                    checked={form.publish_marketplace}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, publish_marketplace: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Direct booking page</div>
                    <div className="text-[11px] text-muted-foreground">
                      Visible on your studio's public booking page — paid at studio
                    </div>
                  </div>
                  <Switch
                    checked={form.publish_direct}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, publish_direct: checked })
                    }
                  />
                </div>
              </div>
              {!form.publish_marketplace && !form.publish_direct && (
                <p className="text-[11px] text-amber-600 mt-2">
                  ⚠ At least one channel should be selected, otherwise the session won't be visible to anyone.
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
                        const totalCapacity = parseInt(form.capacity) || 0;
                        const mp = form.publish_marketplace ? (parseInt(form.allocation_marketplace) || 0) : 0;
                        const dr = form.publish_direct ? (parseInt(form.allocation_direct) || 0) : 0;
                        const sum = mp + dr;
                        const remainder = totalCapacity - sum;
                        return (
                          <div className="space-y-2 pt-1">
                            {form.publish_marketplace && (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs">Marketplace</span>
                                <Input
                                  type="number"
                                  min="0"
                                  max={totalCapacity}
                                  value={form.allocation_marketplace}
                                  onChange={(e) => setForm({ ...form, allocation_marketplace: e.target.value })}
                                  onClick={(e) => e.preventDefault()}
                                  className="h-7 w-20 text-right"
                                  placeholder="0"
                                />
                              </div>
                            )}
                            {form.publish_direct && (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs">Direct booking page</span>
                                <Input
                                  type="number"
                                  min="0"
                                  max={totalCapacity}
                                  value={form.allocation_direct}
                                  onChange={(e) => setForm({ ...form, allocation_direct: e.target.value })}
                                  onClick={(e) => e.preventDefault()}
                                  className="h-7 w-20 text-right"
                                  placeholder="0"
                                />
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-3 pt-1 border-t text-[11px]">
                              <span className="text-muted-foreground">Sum / Capacity</span>
                              <span
                                className={
                                  sum === totalCapacity
                                    ? "text-emerald-600 font-medium"
                                    : sum > totalCapacity
                                      ? "text-destructive font-medium"
                                      : "text-amber-600 font-medium"
                                }
                              >
                                {sum} / {totalCapacity}
                                {remainder > 0 && ` · ${remainder} unassigned`}
                                {remainder < 0 && ` · ${-remainder} over`}
                              </span>
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

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              {editingSession && canManage ? (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                  onClick={() => { handleDelete(editingSession.id); setDialogOpen(false); }}>
                  <Trash2Icon className="size-3.5 mr-1.5" /> Cancel Session
                </Button>
              ) : <div />}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Close</Button>
                <Button onClick={handleSave}
                  disabled={saving || !form.service_id || !form.date || !form.start_time || !form.end_time || !form.capacity}>
                  {saving ? "Saving..." : editingSession ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
