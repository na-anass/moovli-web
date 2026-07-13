"use client";

import { formatMoneyWhole } from "@/lib/money";
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
import { useTranslations } from "next-intl";
import { BookingSheet } from "./booking-sheet";
import {
  formatTime,
  formatDateFull,
  formatDateCustom,
  startOfWeekLocal,
  localDateStr,
  localMinutesOfDay,
  isPast as isPastInstant,
} from "@/lib/datetime";

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
  currency: string;
}

type ViewMode = "calendar" | "list";

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 → 22:00
const HOUR_HEIGHT = 60; // px

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

// Date filter: "all" | "today" | "tomorrow" | "week" | a YYYY-MM-DD string.
const inDateBucket = (iso: string, bucket: string) => {
  if (bucket === "all") return true;
  const day = startOfDay(new Date(iso)).getTime();
  const today = startOfDay(new Date()).getTime();
  if (bucket === "today") return day === today;
  if (bucket === "tomorrow") return day === today + 86_400_000;
  if (bucket === "week") {
    const ws = startOfWeekLocal(new Date()).getTime();
    return day >= ws && day < ws + 7 * 86_400_000;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(bucket)) return localDateStr(new Date(iso)) === bucket;
  return true;
};

// Time-of-day filter by start hour.
const inTimeBucket = (iso: string, bucket: string) => {
  if (bucket === "any") return true;
  const h = new Date(iso).getHours();
  if (bucket === "morning") return h >= 6 && h < 12;
  if (bucket === "afternoon") return h >= 12 && h < 17;
  if (bucket === "evening") return h >= 17 && h < 22;
  return true;
};

const DATE_CHIPS: { value: string; labelKey: string }[] = [
  { value: "all", labelKey: "view.dateChips.all" },
  { value: "today", labelKey: "view.dateChips.today" },
  { value: "tomorrow", labelKey: "view.dateChips.tomorrow" },
  { value: "week", labelKey: "view.dateChips.week" },
];

export function BookingView({ sessions, studioSlug, entityId, channelId, brandColor, currency }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("booking");

  const [view, setView] = useState<ViewMode>("list");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [instructorFilter, setInstructorFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("any");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [calendarDate, setCalendarDate] = useState(startOfWeekLocal(new Date()));

  const hasActiveFilters =
    serviceFilter !== "all" ||
    instructorFilter !== "all" ||
    dateFilter !== "all" ||
    timeFilter !== "any" ||
    availableOnly ||
    searchQuery.length > 0;

  const resetFilters = () => {
    setServiceFilter("all");
    setInstructorFilter("all");
    setDateFilter("all");
    setTimeFilter("any");
    setAvailableOnly(false);
    setSearchQuery("");
  };

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
    const now = new Date();
    return sessions.filter((s) => {
      if (serviceFilter !== "all" && s.service?.id !== serviceFilter) return false;
      if (instructorFilter !== "all" && s.provider?.id !== instructorFilter) return false;
      if (!inDateBucket(s.start_time, dateFilter)) return false;
      if (!inTimeBucket(s.start_time, timeFilter)) return false;
      if (availableOnly) {
        const open = s.capacity - s.booked_count > 0 && new Date(s.end_time) > now;
        if (!open) return false;
      }
      if (q.length > 0) {
        const haystack = [
          s.service?.name ?? "",
          s.provider?.name ?? "",
          formatDateFull(s.start_time),
          formatTime(s.start_time),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, serviceFilter, instructorFilter, dateFilter, timeFilter, availableOnly, searchQuery]);

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
      const dayKey = localDateStr(new Date(s.start_time));
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
  const goThisWeek = () => setCalendarDate(startOfWeekLocal(new Date()));

  const accent = brandColor || "var(--primary)";

  return (
    <div style={{ ["--brand" as string]: accent } as React.CSSProperties}>
      {/* Filters bar — sticky so it stays reachable while scrolling sessions */}
      <div className="sticky top-2 z-20 space-y-3 mb-4 p-3 rounded-lg border bg-card/95 backdrop-blur">
        {/* Top row: search + count */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder={t("view.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {t("view.sessionCount", { count: filtered.length })}
          </div>
        </div>

        {/* Date quick-chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_CHIPS.map((c) => {
            const active = dateFilter === c.value;
            return (
              <button
                key={c.value}
                onClick={() => setDateFilter(c.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${active ? "text-white border-transparent" : "border-input text-muted-foreground hover:text-foreground"}`}
                style={active ? { backgroundColor: accent } : undefined}
              >
                {t(c.labelKey)}
              </button>
            );
          })}
          {/* Specific date */}
          <Input
            type="date"
            value={/^\d{4}-\d{2}-\d{2}$/.test(dateFilter) ? dateFilter : ""}
            onChange={(e) => setDateFilter(e.target.value || "all")}
            className="h-8 w-40 text-xs"
            aria-label={t("view.pickDate")}
          />
        </div>

        {/* Bottom row: filters + view toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {services.length > 1 && (
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("view.allServices")}</SelectItem>
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
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("view.allInstructors")}</SelectItem>
                {instructors.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("view.timeAny")}</SelectItem>
              <SelectItem value="morning">{t("view.timeMorning")}</SelectItem>
              <SelectItem value="afternoon">{t("view.timeAfternoon")}</SelectItem>
              <SelectItem value="evening">{t("view.timeEvening")}</SelectItem>
            </SelectContent>
          </Select>

          <button
            onClick={() => setAvailableOnly((v) => !v)}
            aria-pressed={availableOnly}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition ${availableOnly ? "text-white border-transparent" : "border-input text-muted-foreground hover:text-foreground"}`}
            style={availableOnly ? { backgroundColor: accent } : undefined}
          >
            {t("view.availableOnly")}
          </button>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              {t("view.clearFilters")}
            </button>
          )}

          <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ListIcon className="size-3" /> {t("view.list")}
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${view === "calendar" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              <CalendarIcon className="size-3" /> {t("view.week")}
            </button>
          </div>
        </div>
      </div>

      {view === "calendar" ? (
        <CalendarView
          weekDays={weekDays}
          sessionsByDay={sessionsByDay}
          accent={accent}
          currency={currency}
          onBook={openBooking}
          onPrev={goPrevWeek}
          onNext={goNextWeek}
          onToday={goThisWeek}
        />
      ) : (
        <ListView sessions={filtered} accent={accent} currency={currency} onBook={openBooking} />
      )}

      <BookingSheet
        open={sheetOpen}
        onOpenChange={closeBooking}
        session={activeSession}
        studioSlug={studioSlug}
        entityId={entityId}
        channelId={channelId}
        brandColor={brandColor}
        currency={currency}
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
  currency,
  onBook,
  onPrev,
  onNext,
  onToday,
}: {
  weekDays: Date[];
  sessionsByDay: Map<string, SessionRow[]>;
  accent: string;
  currency: string;
  onBook: (sessionId: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const t = useTranslations("booking");
  const today = new Date();

  return (
    <div className="rounded-lg border overflow-hidden bg-card">
      {/* Week navigator */}
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            className="p-1.5 rounded hover:bg-muted"
            aria-label={t("view.previousWeek")}
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <button
            onClick={onToday}
            className="px-2 py-1 text-xs font-medium rounded hover:bg-muted"
          >
            {t("view.today")}
          </button>
          <button
            onClick={onNext}
            className="p-1.5 rounded hover:bg-muted"
            aria-label={t("view.nextWeek")}
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
        <div className="text-sm font-semibold">
          {formatDateCustom(weekDays[0], { day: "numeric", month: "long" })} —{" "}
          {formatDateCustom(weekDays[6], { day: "numeric", month: "long", year: "numeric" })}
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
                {formatDateCustom(d, { weekday: "short" })}
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
          const dayKey = localDateStr(d);
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
                const startMins = localMinutesOfDay(s.start_time);
                const endMins = localMinutesOfDay(s.end_time);
                const baseMin = HOURS[0] * 60;
                const top = ((startMins - baseMin) / 60) * HOUR_HEIGHT;
                const height = Math.max(28, ((endMins - startMins) / 60) * HOUR_HEIGHT - 2);
                const spotsLeft = s.capacity - s.booked_count;
                const isFull = spotsLeft <= 0;
                const isPast = isPastInstant(s.end_time);

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => !isFull && !isPast && onBook(s.id)}
                    disabled={isFull || isPast}
                    className={`absolute left-0.5 right-0.5 rounded-md border px-2 py-1 overflow-hidden text-[11px] leading-tight text-left transition ${
                      isFull || isPast
                        ? "opacity-50 cursor-not-allowed bg-muted"
                        : "hover:z-10 cursor-pointer"
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
                    <div className="truncate text-foreground/70">{s.service?.name ?? t("session.fallbackName")}</div>
                    {height > 50 && (
                      <div className="truncate text-[10px] text-muted-foreground mt-0.5">
                        {s.provider?.name ? t("session.withInstructor", { name: s.provider.name }) : ""}
                      </div>
                    )}
                    {height > 70 && (
                      <div className="absolute bottom-1 right-1 text-[10px] font-medium" style={{ color: accent }}>
                        {formatMoneyWhole(s.price_mad, currency)}
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
  currency,
  onBook,
}: {
  sessions: SessionRow[];
  accent: string;
  currency: string;
  onBook: (sessionId: string) => void;
}) {
  const t = useTranslations("booking");
  // Group by date
  const sessionsByDate = useMemo(() => {
    const m = new Map<string, SessionRow[]>();
    sessions
      .slice()
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .forEach((s) => {
        const day = localDateStr(new Date(s.start_time));
        if (!m.has(day)) m.set(day, []);
        m.get(day)!.push(s);
      });
    return m;
  }, [sessions]);

  if (sessionsByDate.size === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("view.emptyState")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(sessionsByDate.entries()).map(([day, daySessions]) => (
        <section key={day}>
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            {formatDateFull(daySessions[0].start_time)}
          </h2>
          <div className="space-y-2">
            {daySessions.map((s) => {
              const spotsLeft = s.capacity - s.booked_count;
              const isFull = spotsLeft <= 0;
              return (
                <div
                  key={s.id}
                  className={`rounded-lg border p-4 transition ${isFull ? "opacity-50" : ""}`}
                  style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                    {/* Left: time + name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-base">{formatTime(s.start_time)}</span>
                        <span className="text-sm">{s.service?.name ?? t("session.fallbackName")}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                        {s.service?.duration_minutes != null && (
                          <span className="inline-flex items-center gap-1">
                            <ClockIcon className="size-3" /> {t("session.durationMin", { minutes: s.service.duration_minutes })}
                          </span>
                        )}
                        {s.provider?.name && <span>{t("session.withInstructor", { name: s.provider.name })}</span>}
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
                          {formatMoneyWhole(s.price_mad, currency)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{t("session.atStudio")}</div>
                      </div>
                      {isFull ? (
                        <Badge variant="outline">{t("session.full")}</Badge>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onBook(s.id)}
                          className="inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
                          style={{ backgroundColor: accent }}
                        >
                          {t("session.book")}
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
