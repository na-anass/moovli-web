// ============================================================================
// Date ranges for reporting screens (dashboard, insights, …)
// ----------------------------------------------------------------------------
// A range is a pair of viewer-local calendar days, both INCLUSIVE, as
// "YYYY-MM-DD" strings. The API turns them into half-open boundaries and
// compares against the equal-length period right before (for trends).
//
// The selection lives in the URL (`?range=30d` or
// `?range=custom&from=2026-09-01&to=2026-09-15`) so a filtered view can be
// bookmarked or shared.
// ============================================================================

import {
  differenceInCalendarDays,
  endOfMonth,
  isValid,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { localDateStr } from "@/lib/datetime";

export const DATE_RANGE_PRESETS = [
  "today",
  "7d",
  "30d",
  "90d",
  "thisMonth",
  "lastMonth",
  "custom",
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export interface DateRange {
  preset: DateRangePreset;
  /** First day, inclusive (YYYY-MM-DD). */
  from: string;
  /** Last day, inclusive (YYYY-MM-DD). */
  to: string;
}

/** Must stay in sync with MAX_REPORT_RANGE_DAYS in moovli-api studio.routes.ts. */
export const MAX_RANGE_DAYS = 366;

export const DEFAULT_PRESET: Exclude<DateRangePreset, "custom"> = "7d";

const isDay = (value: string | null | undefined): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));

/** Resolve a non-custom preset to concrete days, relative to `today`. */
export const resolvePreset = (
  preset: Exclude<DateRangePreset, "custom">,
  today: Date = new Date(),
): DateRange => {
  const to = localDateStr(today);
  switch (preset) {
    case "today":
      return { preset, from: to, to };
    case "7d":
      return { preset, from: localDateStr(subDays(today, 6)), to };
    case "30d":
      return { preset, from: localDateStr(subDays(today, 29)), to };
    case "90d":
      return { preset, from: localDateStr(subDays(today, 89)), to };
    case "thisMonth":
      // Whole calendar month: session-dated figures (scheduled sessions, expected
      // revenue) need the days still ahead.
      return {
        preset,
        from: localDateStr(startOfMonth(today)),
        to: localDateStr(endOfMonth(today)),
      };
    case "lastMonth": {
      const lastMonth = subMonths(today, 1);
      return {
        preset,
        from: localDateStr(startOfMonth(lastMonth)),
        to: localDateStr(endOfMonth(lastMonth)),
      };
    }
  }
};

/**
 * True once the range has fully elapsed. Period-over-period trends are only
 * meaningful then — a half-finished month vs a full previous month reads as a drop.
 */
export const isRangeComplete = (range: Pick<DateRange, "to">, today: Date = new Date()): boolean =>
  range.to <= localDateStr(today);

/** Number of days in a range, both ends included. */
export const rangeLengthDays = (from: string, to: string): number =>
  differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;

/** A custom range is usable when both days parse, are ordered, and fit the cap. */
export const isValidCustomRange = (from: string, to: string): boolean =>
  isDay(from) && isDay(to) && from <= to && rangeLengthDays(from, to) <= MAX_RANGE_DAYS;

/** Read the range from URL search params, falling back to `fallback` (default: last 7 days). */
export const parseDateRange = (
  params: URLSearchParams,
  fallback: Exclude<DateRangePreset, "custom"> = DEFAULT_PRESET,
): DateRange => {
  const preset = params.get("range") as DateRangePreset | null;
  if (preset === "custom") {
    const from = params.get("from");
    const to = params.get("to");
    if (isDay(from) && isDay(to) && isValidCustomRange(from, to)) {
      return { preset, from, to };
    }
  } else if (preset && (DATE_RANGE_PRESETS as readonly string[]).includes(preset)) {
    return resolvePreset(preset);
  }
  return resolvePreset(fallback);
};

/** Write the range into (a copy of) the given search params. */
export const serializeDateRange = (range: DateRange, params: URLSearchParams): URLSearchParams => {
  const next = new URLSearchParams(params);
  next.set("range", range.preset);
  if (range.preset === "custom") {
    next.set("from", range.from);
    next.set("to", range.to);
  } else {
    next.delete("from");
    next.delete("to");
  }
  return next;
};
