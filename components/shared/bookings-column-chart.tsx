"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { parseISO, startOfWeek } from "date-fns";
import { formatDateCustom, localDateStr } from "@/lib/datetime";

export interface DailyBookingsPoint {
  /** Viewer-local day, YYYY-MM-DD. */
  date: string;
  bookings: number;
  cancelled: number;
}

interface Bucket {
  /** First day of the bucket (YYYY-MM-DD). */
  start: string;
  bookings: number;
  cancelled: number;
}

/** Above this many days, bars are grouped by week so each stays readable. */
const MAX_DAILY_BARS = 92;

const CHART_HEIGHT = 180;

/** Round up to 1 / 2 / 5 × 10^k (min 1) so the axis ticks are clean integers. */
const niceStep = (raw: number): number => {
  if (raw <= 1) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * pow;
};

const bucketize = (daily: DailyBookingsPoint[]): { buckets: Bucket[]; weekly: boolean } => {
  if (daily.length <= MAX_DAILY_BARS) {
    return {
      buckets: daily.map((d) => ({ start: d.date, bookings: d.bookings, cancelled: d.cancelled })),
      weekly: false,
    };
  }
  const byWeek = new Map<string, Bucket>();
  for (const d of daily) {
    const key = localDateStr(startOfWeek(parseISO(d.date), { weekStartsOn: 1 }));
    // A partial first week is labelled from the range's first day, not the Monday before it.
    const bucket = byWeek.get(key) ?? { start: d.date, bookings: 0, cancelled: 0 };
    bucket.bookings += d.bookings;
    bucket.cancelled += d.cancelled;
    byWeek.set(key, bucket);
  }
  return { buckets: [...byWeek.values()], weekly: true };
};

/**
 * Single-series column chart of bookings over a date range. Bars are grouped by
 * week for long ranges; each bar has a hover/focus tooltip and the same data is
 * exposed as a screen-reader table.
 */
export function BookingsColumnChart({ daily }: { daily: DailyBookingsPoint[] }) {
  const t = useTranslations("studioMain.insights.chart");
  const locale = useLocale();
  const [active, setActive] = useState<number | null>(null);

  const { buckets, weekly } = useMemo(() => bucketize(daily), [daily]);
  const max = Math.max(0, ...buckets.map((b) => b.bookings));
  const step = niceStep(max / 2);
  const axisMax = step * 2;

  const label = (b: Bucket) => {
    const day = formatDateCustom(parseISO(b.start), { day: "numeric", month: "short" }, locale);
    return weekly ? t("weekOf", { date: day }) : day;
  };

  // Label only the first, middle and last bar so axis text never collides.
  const tickIndexes = new Set([0, Math.floor((buckets.length - 1) / 2), buckets.length - 1]);
  const activeBucket = active !== null ? buckets[active] : null;

  return (
    <div>
      <div className="flex gap-3">
        {/* Y axis */}
        <div
          className="relative w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground"
          style={{ height: CHART_HEIGHT }}
          aria-hidden
        >
          {[axisMax, step, 0].map((v, i) => (
            <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${i * 50}%` }}>
              {v}
            </span>
          ))}
        </div>

        {/* Plot */}
        <div className="relative flex-1 min-w-0" style={{ height: CHART_HEIGHT }}>
          {[0, 50, 100].map((top) => (
            <div
              key={top}
              className="absolute inset-x-0 border-t border-border"
              style={{ top: `${top}%` }}
              aria-hidden
            />
          ))}

          <div
            className="absolute inset-0 flex items-end gap-[2px]"
            onMouseLeave={() => setActive(null)}
            aria-hidden
          >
            {buckets.map((b, i) => (
              <button
                key={b.start}
                type="button"
                tabIndex={-1}
                className="group flex h-full flex-1 min-w-0 items-end justify-center cursor-default"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
              >
                <span
                  className={`block w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity ${
                    active !== null && active !== i ? "opacity-50" : ""
                  }`}
                  style={{ height: `${axisMax > 0 ? (b.bookings / axisMax) * 100 : 0}%` }}
                />
              </button>
            ))}
          </div>

          {activeBucket && active !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md whitespace-nowrap"
              style={{
                left: `clamp(3rem, ${((active + 0.5) / buckets.length) * 100}%, calc(100% - 3rem))`,
              }}
            >
              <p className="font-medium text-foreground">{label(activeBucket)}</p>
              <p className="text-muted-foreground">
                {t("bookings", { count: activeBucket.bookings })}
                {activeBucket.cancelled > 0 && ` · ${t("cancelled", { count: activeBucket.cancelled })}`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* X axis */}
      <div className="ml-11 mt-2 flex gap-[2px] text-[10px] text-muted-foreground" aria-hidden>
        {buckets.map((b, i) => (
          <div key={b.start} className="relative flex-1 min-w-0">
            {tickIndexes.has(i) && (
              <span
                className={`absolute whitespace-nowrap ${
                  i === 0 ? "left-0" : i === buckets.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2"
                }`}
              >
                {label(b)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="h-4" aria-hidden />

      {/* Same data for assistive tech */}
      <table className="sr-only">
        <caption>{weekly ? t("captionWeekly") : t("captionDaily")}</caption>
        <thead>
          <tr>
            <th scope="col">{weekly ? t("week") : t("day")}</th>
            <th scope="col">{t("bookingsHeader")}</th>
            <th scope="col">{t("cancelledHeader")}</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.start}>
              <th scope="row">{label(b)}</th>
              <td>{b.bookings}</td>
              <td>{b.cancelled}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
