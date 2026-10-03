"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { InsightsSlot } from "@/lib/api/studio";

/**
 * Fill rate by weekday and hour — which classes actually sell.
 *
 * Rows are derived from the hours the studio really runs, not a fixed 07:00–21:00
 * grid: a studio with only evening classes shouldn't read as mostly empty.
 *
 * Magnitude on one hue (the brand violet at five steps), so "darker = fuller".
 * A red-to-green scale would imply a judgement the data can't make — 40% on a
 * deliberately small class is not a failure.
 */

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** Five steps of the primary ramp — light (empty) to dark (full). */
const BUCKETS = [
  { max: 25, className: "bg-primary/10" },
  { max: 50, className: "bg-primary/25" },
  { max: 70, className: "bg-primary/45" },
  { max: 85, className: "bg-primary/70" },
  { max: 101, className: "bg-primary" },
];

const bucketFor = (pct: number) =>
  BUCKETS.find((b) => pct < b.max)?.className ?? BUCKETS[BUCKETS.length - 1].className;

export function FillHeatmap({ slots }: { slots: InsightsSlot[] }) {
  const t = useTranslations("studioMain.insights");
  const [hovered, setHovered] = useState<string | null>(null);

  const { hours, byKey } = useMemo(() => {
    const map = new Map<string, InsightsSlot>();
    for (const slot of slots) map.set(`${slot.weekday}-${slot.hour}`, slot);
    return {
      hours: [...new Set(slots.map((s) => s.hour))].sort((a, b) => a - b),
      byKey: map,
    };
  }, [slots]);

  if (hours.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">{t("fill.empty")}</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[520px] gap-1.5"
          style={{ gridTemplateColumns: "3.5rem repeat(7, minmax(2.75rem, 1fr))" }}
        >
          <div />
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {t(`weekdays.${weekday}`)}
            </div>
          ))}

          {hours.map((hour) => (
            <FragmentRow
              key={hour}
              hour={hour}
              byKey={byKey}
              hovered={hovered}
              setHovered={setHovered}
              t={t}
            />
          ))}
        </div>
      </div>

      {/* Scale */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-medium text-muted-foreground">
        <span>{t("fill.legendLow")}</span>
        {BUCKETS.map((b) => (
          <span key={b.max} className={`size-3.5 rounded-sm ${b.className}`} aria-hidden />
        ))}
        <span>{t("fill.legendHigh")}</span>
      </div>

      {/* Same figures for assistive tech. */}
      <table className="sr-only">
        <caption>{t("fill.caption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("fill.slot")}</th>
            <th scope="col">{t("fill.sessionsHeader")}</th>
            <th scope="col">{t("fill.rateHeader")}</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={`${slot.weekday}-${slot.hour}`}>
              <th scope="row">
                {t(`weekdays.${slot.weekday}`)} {String(slot.hour).padStart(2, "0")}:00
              </th>
              <td>{slot.sessions}</td>
              <td>{slot.capacity > 0 ? Math.round((slot.booked / slot.capacity) * 100) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({
  hour,
  byKey,
  hovered,
  setHovered,
  t,
}: {
  hour: number;
  byKey: Map<string, InsightsSlot>;
  hovered: string | null;
  setHovered: (key: string | null) => void;
  t: ReturnType<typeof useTranslations<"studioMain.insights">>;
}) {
  return (
    <>
      <div className="flex items-center text-[11px] font-medium text-muted-foreground">
        {String(hour).padStart(2, "0")}:00
      </div>
      {WEEKDAYS.map((weekday) => {
        const key = `${weekday}-${hour}`;
        const slot = byKey.get(key);
        const pct = slot && slot.capacity > 0 ? Math.round((slot.booked / slot.capacity) * 100) : 0;
        const perSession = slot && slot.sessions > 0 ? Math.round(slot.booked / slot.sessions) : 0;

        return (
          <div key={key} className="relative">
            <div
              className={`h-9 rounded-md transition-transform ${
                slot
                  ? `${bucketFor(pct)} cursor-default hover:scale-105`
                  : "bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_4px,transparent_4px,transparent_8px)]"
              }`}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              aria-hidden
            />
            {hovered === key && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                {slot ? (
                  <>
                    <p className="font-medium text-foreground">{pct}% {t("fill.filled")}</p>
                    <p className="text-muted-foreground">
                      {t("fill.perSession", { count: perSession, sessions: slot.sessions })}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">{t("fill.noSessions")}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
