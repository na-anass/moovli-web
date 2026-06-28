// ============================================================================
// Unified date/time utilities
// ----------------------------------------------------------------------------
// Single source of truth for formatting/converting session/booking times.
//
// IMPORTANT — `sessions.start_time`/`end_time` are `timestamp WITHOUT time zone`
// (naive WALL-CLOCK), and the API returns them WITHOUT an offset, e.g.
// "2026-04-09T08:00:00". So the convention is:
//
//   • A time means the studio's wall-clock — "08:00" is 8 AM at the studio,
//     full stop. No timezone math is applied anywhere.
//   • WRITE: send the typed wall-clock as `YYYY-MM-DDTHH:mm:00Z`. The naive
//     column drops the `Z` and stores the face value. (The `Z` is only there so
//     it passes the API's `z.string().datetime()` validation.) Do NOT use
//     `toISOString()` — that applies the browser's UTC offset and shifts the
//     stored time (e.g. 08:00 → 07:00 in UTC+1).
//   • READ/DISPLAY: `new Date("...T08:00:00")` (no offset) is parsed as local,
//     so `toLocaleTimeString`/`getHours` render the face value in ANY browser.
//     This makes display correct and timezone-agnostic.
// ============================================================================

import {
  addDays as dfAddDays,
  differenceInMinutes,
  formatDistanceToNow,
  isPast as dfIsPast,
  isSameDay,
  startOfWeek,
} from "date-fns";

/** Locale used for every human-facing date/time string. */
const LOCALE = "en-GB";

/** undefined = viewer's local timezone. Set to an IANA zone to pin display tz. */
const DISPLAY_TIME_ZONE: string | undefined = undefined;

/** Shown when a value is null/undefined/unparseable. */
const PLACEHOLDER = "—";

export type DateInput = string | number | Date | null | undefined;

const toDate = (value: DateInput): Date | null => {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** The single Intl chokepoint — all display formatters go through here. */
const fmt = (value: DateInput, options: Intl.DateTimeFormatOptions): string => {
  const d = toDate(value);
  if (!d) return PLACEHOLDER;
  return d.toLocaleString(LOCALE, { ...options, timeZone: DISPLAY_TIME_ZONE });
};

// ----------------------------------------------------------------------------
// DISPLAY — read a true-UTC instant, render in the viewer's local timezone.
// ----------------------------------------------------------------------------

/** "09:00" */
export const formatTime = (value: DateInput): string =>
  fmt(value, { hour: "2-digit", minute: "2-digit" });

/** "7 Sep 2026" */
export const formatDate = (value: DateInput): string =>
  fmt(value, { day: "numeric", month: "short", year: "numeric" });

/** "7 September 2026" */
export const formatDateLong = (value: DateInput): string =>
  fmt(value, { day: "numeric", month: "long", year: "numeric" });

/** "Monday, 7 September 2026" */
export const formatDateFull = (value: DateInput): string =>
  fmt(value, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** "Mon, 7 Sep" */
export const formatWeekdayShort = (value: DateInput): string =>
  fmt(value, { weekday: "short", day: "numeric", month: "short" });

/** "Mon, 7 Sep, 09:00" */
export const formatDateTime = (value: DateInput): string =>
  fmt(value, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** "09:00 – 10:00" */
export const formatTimeRange = (start: DateInput, end: DateInput): string =>
  `${formatTime(start)} – ${formatTime(end)}`;

/** "in 2 hours" / "3 days ago" */
export const formatRelative = (value: DateInput): string => {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : PLACEHOLDER;
};

/**
 * Escape hatch for bespoke field combinations (e.g. calendar-nav labels) that
 * don't warrant a named helper. Locale and timezone stay fixed — callers choose
 * only WHICH fields to show, not the locale, so the app stays consistent.
 */
export const formatDateCustom = (value: DateInput, options: Intl.DateTimeFormatOptions): string =>
  fmt(value, options);

// ----------------------------------------------------------------------------
// FORMS — wall-clock ↔ instant boundary (viewer-local). Centralized because
// this is where the timezone bug used to live.
// ----------------------------------------------------------------------------

/** `YYYY-MM-DD` for a Date in the viewer's local timezone (matches <input type=date>). */
export const localDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** ISO instant → local "YYYY-MM-DD" for <input type=date>. */
export const toDateInput = (value: DateInput): string => {
  const d = toDate(value);
  return d ? localDateStr(d) : "";
};

/** Naive instant → "HH:mm" for <input type=time> (face value, no offset). */
export const toTimeInput = (value: DateInput): string => {
  const d = toDate(value);
  return d ? d.toTimeString().slice(0, 5) : "";
};

/**
 * Date + "HH:mm" the user typed → an API-bound wall-clock string. Sends the
 * FACE VALUE with a trailing `Z` (so it passes `z.string().datetime()`); the
 * `timestamp without time zone` column drops the `Z` and stores "08:00" as-is.
 * Deliberately NOT `toISOString()` — that would apply the browser's UTC offset
 * and shift the stored time (08:00 → 07:00 in UTC+1).
 */
export const localInputsToISO = (dateStr: string, timeStr: string): string =>
  `${dateStr}T${timeStr}:00Z`;

// ----------------------------------------------------------------------------
// CALENDAR / MATH — backed by date-fns; stop hand-rolling these.
// ----------------------------------------------------------------------------

/** Whether the instant is in the past. */
export const isPast = (value: DateInput): boolean => {
  const d = toDate(value);
  return d ? dfIsPast(d) : false;
};

/** Same local calendar day? */
export const isSameLocalDay = (a: Date, b: Date): boolean => isSameDay(a, b);

/** Whole minutes between two instants (end − start). */
export const durationMinutes = (start: DateInput, end: DateInput): number => {
  const s = toDate(start);
  const e = toDate(end);
  return s && e ? differenceInMinutes(e, s) : 0;
};

/** Monday-anchored start of the local week (00:00 local). */
export const startOfWeekLocal = (d: Date): Date => startOfWeek(d, { weekStartsOn: 1 });

/** Add `n` days, preserving local wall-clock. */
export const addDays = (d: Date, n: number): Date => dfAddDays(d, n);

/** Minutes since local midnight for an instant — for calendar positioning. */
export const localMinutesOfDay = (value: DateInput): number => {
  const d = toDate(value);
  return d ? d.getHours() * 60 + d.getMinutes() : 0;
};

// ----------------------------------------------------------------------------
// "HH:mm" string helpers (timezone-free clock arithmetic).
// ----------------------------------------------------------------------------

/** "09:00" + 90 → "10:30" (wraps at 24h). */
export const addMinutesToTime = (time: string, minutes: number): string => {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** Minutes between two "HH:mm" clock strings (end − start). */
export const minutesBetweenTimes = (start: string, end: string): number => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};
