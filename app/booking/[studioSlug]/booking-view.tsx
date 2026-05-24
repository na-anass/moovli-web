"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ListIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BookingSheet } from "./booking-sheet";

export interface SessionRow {
  id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  status: string;
  price_mad: number;
  service: { id: string; name: string; slug: string; duration_minutes: number } | null;
  provider: { id: string; name: string } | null;
}

interface Props {
  sessions: SessionRow[];
  studioSlug: string;
  entityId: string;
  channelId: string;
  brandColor?: string | null;
}

type ViewMode = "calendar" | "list";

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 → 22:00
const HOUR_HEIGHT = 60; // px

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const formatDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

const formatDateLong = (d: Date) =>
  d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

const getWeekStart = (d: Date) => {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as week start
  const result = new Date(d);
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function BookingView({ sessions, studioSlug, entityId, channelId, brandColor }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewMode>("list");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [instructorFilter, setInstructorFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [calendarDate, setCalendarDate] = useState(getWeekStart(new Date()));

  // Booking sheet — opened by clicking a session card.
  // URL syncs to ?book=<sessionId> so it's shareable + back-button friendly.
  const bookId = searchParams.get("book");
  const activeSession = useMemo(
    () => (bookId ? sessions.find((s) => s.id === bookId) ?? null : null),
    [bookId, sessions],
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setSheetOpen(Boolean(bookId && activeSession));
  }, [bookId, activeSession]);

  const openBooking = (sessionId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("book", sessionId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const closeBooking = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("book");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    }
  };

  // Distinct services + instructors for filter dropdowns
  const services = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    sessions.forEach((s) => {
      if (s.service?.id && !m.has(s.service.id)) m.set(s.service.id, { id: s.service.id, name: s.service.name });
    });
    return Array.from(m.values());
  }, [sessions]);

  const instructors = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    sessions.forEach((s) => {
      if (s.provider?.id && !m.has(s.provider.id)) m.set(s.provider.id, { id: s.provider.id, name: s.provider.name });
    });
    return Array.from(m.values());
  }, [sessions]);

  // Apply filters + free-text search
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      if (serviceFilter !== "all" && s.service?.id !== serviceFilter) return false;
      if (instructorFilter !== "all" && s.provider?.id !== instructorFilter) return false;
      if (q.length > 0) {
        const haystack = [
          s.service?.name ?? "",
          s.provider?.name ?? "",
          new Date(s.start_time).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
          new Date(s.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, serviceFilter, instructorFilter, searchQuery]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(calendarDate);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [calendarDate]);

  // Sessions in current week, indexed by day
  const sessionsByDay = useMemo(() => {
    const map = new Map<string, SessionRow[]>();
    filtered.forEach((s) => {
      const dayKey = s.start_time.slice(0, 10);
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)!.push(s);
    });
    return map;
  }, [filtered]);

  const goPrevWeek = () => {
    const d = new Date(calendarDate);
    d.setDate(d.getDate() - 7);
    setCalendarDate(d);
  };
  const goNextWeek = () => {
    const d = new Date(calendarDate);
    d.setDate(d.getDate() + 7);
    setCalendarDate(d);
  };
  const goThisWeek = () => setCalendarDate(getWeekStart(new Date()));

  const accent = brandColor || "var(--primary)";

  return (
    <div style={{ ["--brand" as string]: accent } as React.CSSProperties}>
      {/* Filters bar */}
      <div className="space-y-3 mb-4 p-3 rounded-lg border bg-card">
        {/* Top row: search + count */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search by class, instructor, day…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {filtered.length} session{filtered.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Bottom row: filters + view toggle */}
        <div className="flex flex-wrap items-center gap-3">
          {services.length > 1 && (
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-45 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All services</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {instructors.length > 1 && (
            <Select value={instructorFilter} onValueChange={setInstructorFilter}>
              <SelectTrigger className="w-45 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All instructors</SelectItem>
                {instructors.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {(serviceFilter !== "all" || instructorFilter !== "all" || searchQuery.length > 0) && (
            <button
              onClick={() => {
                setServiceFilter("all");
                setInstructorFilter("all");
                setSearchQuery("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Clear filters
            </button>
          )}

          <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ListIcon className="size-3" /> List
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${view === "calendar" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              <CalendarIcon className="size-3" /> Week
            </button>
          </div>
        </div>
      </div>

      {view === "calendar" ? (
        <CalendarView
          weekDays={weekDays}
          sessionsByDay={sessionsByDay}
          accent={accent}
          onBook={openBooking}
          onPrev={goPrevWeek}
          onNext={goNextWeek}
          onToday={goThisWeek}
        />
      ) : (
        <ListView sessions={filtered} accent={accent} onBook={openBooking} />
      )}

      <BookingSheet
        open={sheetOpen}
        onOpenChange={closeBooking}
        session={activeSession}
        studioSlug={studioSlug}
        entityId={entityId}
        channelId={channelId}
        brandColor={brandColor}
      />
    </div>
  );
}

// ============================================================================
// CALENDAR VIEW
// ============================================================================

function CalendarView({
  weekDays,
  sessionsByDay,
  accent,
  onBook,
  onPrev,
  onNext,
  onToday,
}: {
  weekDays: Date[];
  sessionsByDay: Map<string, SessionRow[]>;
  accent: string;
  onBook: (sessionId: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const today = new Date();

  return (
    <div className="rounded-lg border overflow-hidden bg-card">
      {/* Week navigator */}
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            className="p-1.5 rounded hover:bg-muted"
            aria-label="Previous week"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <button
            onClick={onToday}
            className="px-2 py-1 text-xs font-medium rounded hover:bg-muted"
          >
            Today
          </button>
          <button
            onClick={onNext}
            className="p-1.5 rounded hover:bg-muted"
            aria-label="Next week"
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
        <div className="text-sm font-semibold">
          {weekDays[0].toLocaleDateString("en-GB", { day: "numeric", month: "long" })} —{" "}
          {weekDays[6].toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </div>
        <div className="w-[120px]" />
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b text-xs">
        <div className="border-r" />
        {weekDays.map((d) => {
          const isToday = sameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={`p-2 text-center border-r last:border-r-0 ${isToday ? "bg-muted/50" : ""}`}
            >
              <div className="text-muted-foreground uppercase tracking-wider">
                {d.toLocaleDateString("en-GB", { weekday: "short" })}
              </div>
              <div
                className={`text-base font-semibold mt-0.5 ${isToday ? "text-foreground" : ""}`}
                style={isToday ? { color: accent } : undefined}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="relative grid grid-cols-[60px_repeat(7,1fr)] overflow-x-auto">
        {/* Hour rail */}
        <div className="border-r">
          {HOURS.map((h) => (
            <div
              key={h}
              className="border-b text-[10px] text-muted-foreground text-right pr-1.5 pt-1"
              style={{ height: HOUR_HEIGHT }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDays.map((d) => {
          const dayKey = d.toISOString().slice(0, 10);
          const daySessions = sessionsByDay.get(dayKey) ?? [];
          return (
            <div
              key={d.toISOString()}
              className="relative border-r last:border-r-0"
              style={{ height: HOURS.length * HOUR_HEIGHT }}
            >
              {/* Hour grid lines */}
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-b border-border/40"
                  style={{ top: (h - HOURS[0]) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                />
              ))}

              {/* Sessions */}
              {daySessions.map((s) => {
                const start = new Date(s.start_time);
                const end = new Date(s.end_time);
                const startMins = start.getHours() * 60 + start.getMinutes();
                const endMins = end.getHours() * 60 + end.getMinutes();
                const baseMin = HOURS[0] * 60;
                const top = ((startMins - baseMin) / 60) * HOUR_HEIGHT;
                const height = Math.max(28, ((endMins - startMins) / 60) * HOUR_HEIGHT - 2);
                const spotsLeft = s.capacity - s.booked_count;
                const isFull = spotsLeft <= 0;
                const isPast = end <= new Date();

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => !isFull && !isPast && onBook(s.id)}
                    disabled={isFull || isPast}
                    className={`absolute left-0.5 right-0.5 rounded-md border px-2 py-1 overflow-hidden text-[11px] leading-tight text-left transition ${
                      isFull || isPast
                        ? "opacity-50 cursor-not-allowed bg-muted"
                        : "hover:shadow-sm hover:z-10 cursor-pointer"
                    }`}
                    style={{
                      top,
                      height,
                      borderLeftColor: accent,
                      borderLeftWidth: 3,
                      backgroundColor: isFull || isPast ? undefined : `color-mix(in srgb, ${accent} 8%, transparent)`,
                    }}
                  >
                    <div className="font-medium truncate">{formatTime(s.start_time)}</div>
                    <div className="truncate text-foreground/70">{s.service?.name ?? "Session"}</div>
                    {height > 50 && (
                      <div className="truncate text-[10px] text-muted-foreground mt-0.5">
                        {s.provider?.name ? `with ${s.provider.name}` : ""}
                      </div>
                    )}
                    {height > 70 && (
                      <div className="absolute bottom-1 right-1 text-[10px] font-medium" style={{ color: accent }}>
                        {Number(s.price_mad).toFixed(0)} MAD
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// LIST VIEW
// ============================================================================

function ListView({
  sessions,
  accent,
  onBook,
}: {
  sessions: SessionRow[];
  accent: string;
  onBook: (sessionId: string) => void;
}) {
  // Group by date
  const sessionsByDate = useMemo(() => {
    const m = new Map<string, SessionRow[]>();
    sessions
      .slice()
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .forEach((s) => {
        const day = s.start_time.slice(0, 10);
        if (!m.has(day)) m.set(day, []);
        m.get(day)!.push(s);
      });
    return m;
  }, [sessions]);

  if (sessionsByDate.size === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">No upcoming sessions match your filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(sessionsByDate.entries()).map(([day, daySessions]) => (
        <section key={day}>
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            {formatDateLong(new Date(day))}
          </h2>
          <div className="space-y-2">
            {daySessions.map((s) => {
              const spotsLeft = s.capacity - s.booked_count;
              const isFull = spotsLeft <= 0;
              return (
                <div
                  key={s.id}
                  className={`rounded-lg border p-4 transition ${isFull ? "opacity-50" : "hover:shadow-sm"}`}
                  style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                    {/* Left: time + name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-base">{formatTime(s.start_time)}</span>
                        <span className="text-sm">{s.service?.name ?? "Session"}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                        {s.service?.duration_minutes != null && (
                          <span className="inline-flex items-center gap-1">
                            <ClockIcon className="size-3" /> {s.service.duration_minutes}min
                          </span>
                        )}
                        {s.provider?.name && <span>with {s.provider.name}</span>}
                        <span className="inline-flex items-center gap-1">
                          <UsersIcon className="size-3" /> {spotsLeft}/{s.capacity}
                        </span>
                      </div>
                    </div>

                    {/* Right: price + primary CTA */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div
                          className="font-semibold text-lg leading-none"
                          style={!isFull ? { color: accent } : undefined}
                        >
                          {Number(s.price_mad).toFixed(0)} MAD
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">at studio</div>
                      </div>
                      {isFull ? (
                        <Badge variant="outline">Full</Badge>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onBook(s.id)}
                          className="inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
                          style={{ backgroundColor: accent }}
                        >
                          Book
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
