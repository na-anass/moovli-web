"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { parseISO, startOfWeek } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDateCustom, localDateStr } from "@/lib/datetime";
import { formatMoneyWhole } from "@/lib/money";
import type { InsightsDailyRevenuePoint } from "@/lib/api/studio";

/**
 * Revenue per day, split by where the booking came from.
 *
 * Two series only: Direct and Marketplace. "Other" exists in the data for
 * bookings with no channel (legacy rows) and is rendered only when non-zero,
 * rather than always showing an empty third series.
 *
 * Colours come from the theme's chart tokens, which are defined for light and
 * dark — the same violet/mint pair the dashboard uses for this split. A legend
 * is always present and the figures are repeated in a screen-reader table, so
 * nothing depends on colour alone.
 */

/** Past this many points the x-axis gets unreadable, so days roll up into weeks. */
const MAX_DAILY_BARS = 92;
const CHART_HEIGHT = 260;

interface Bucket {
  start: string;
  direct: number;
  marketplace: number;
  other: number;
}

const bucketize = (
  daily: InsightsDailyRevenuePoint[],
): { buckets: Bucket[]; weekly: boolean } => {
  if (daily.length <= MAX_DAILY_BARS) {
    return { buckets: daily.map((d) => ({ ...d, start: d.date })), weekly: false };
  }
  const byWeek = new Map<string, Bucket>();
  for (const d of daily) {
    const key = localDateStr(startOfWeek(parseISO(d.date), { weekStartsOn: 1 }));
    // A partial first week is labelled from the range's first day.
    const bucket = byWeek.get(key) ?? { start: d.date, direct: 0, marketplace: 0, other: 0 };
    bucket.direct += d.direct;
    bucket.marketplace += d.marketplace;
    bucket.other += d.other;
    byWeek.set(key, bucket);
  }
  return { buckets: [...byWeek.values()], weekly: true };
};

export function RevenueChart({
  daily,
  currency,
}: {
  daily: InsightsDailyRevenuePoint[];
  currency: string;
}) {
  const t = useTranslations("studioMain.insights");
  const locale = useLocale();

  const { buckets, weekly } = useMemo(() => bucketize(daily), [daily]);
  const hasOther = buckets.some((b) => b.other > 0);
  const hasRevenue = buckets.some((b) => b.direct + b.marketplace + b.other > 0);

  const label = (start: string) => {
    const day = formatDateCustom(parseISO(start), { day: "numeric", month: "short" }, locale);
    return weekly ? t("chart.weekOf", { date: day }) : day;
  };

  const series = [
    { key: "direct" as const, color: "var(--chart-1)", name: t("sources.direct") },
    { key: "marketplace" as const, color: "var(--chart-2)", name: t("sources.marketplace") },
    ...(hasOther
      ? [{ key: "other" as const, color: "var(--muted-foreground)", name: t("sources.other") }]
      : []),
  ];

  // Bare axes with no bars read as "broken", not "nothing happened" — say it.
  if (!hasRevenue) {
    return <p className="py-10 text-sm text-muted-foreground">{t("noRevenue")}</p>;
  }

  return (
    <div>
      {/* Legend — always present, so a series is never identified by colour alone. */}
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: s.color }}
              aria-hidden
            />
            {s.name}
          </span>
        ))}
      </div>

      <div style={{ height: CHART_HEIGHT }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="start"
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              // Keep roughly 8 labels whatever the range length.
              interval={Math.max(0, Math.ceil(buckets.length / 8) - 1)}
              tickFormatter={(value: string) =>
                formatDateCustom(parseISO(value), { day: "numeric", month: "short" }, locale)
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              // Compact, and without the currency: the card header carries it,
              // and "MAD 12,000" per tick clips at this width.
              tickFormatter={(value: number) =>
                new Intl.NumberFormat(locale, { notation: "compact" }).format(value)
              }
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              content={({ active, payload, label: axisLabel }) => {
                if (!active || !payload?.length) return null;
                const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
                return (
                  <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="font-medium text-foreground">{label(String(axisLabel))}</p>
                    {payload.map((p) => (
                      <p key={p.dataKey as string} className="mt-1 text-muted-foreground">
                        <span
                          className="mr-1.5 inline-block size-2 rounded-sm align-middle"
                          style={{ background: p.color }}
                        />
                        {series.find((s) => s.key === p.dataKey)?.name}:{" "}
                        <span className="font-medium text-foreground">
                          {formatMoneyWhole(Number(p.value) || 0, currency)}
                        </span>
                      </p>
                    ))}
                    <p className="mt-1.5 border-t border-border pt-1.5 font-medium text-foreground">
                      {t("chart.total")}: {formatMoneyWhole(total, currency)}
                    </p>
                  </div>
                );
              }}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="revenue"
                fill={s.color}
                // Round only the top of the stack, and leave a hairline of
                // surface between neighbouring bars.
                radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
                maxBarSize={24}
                // Off on purpose: a dashboard that re-animates on every resize
                // or refetch is noise, and it makes screenshots unreliable.
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Same figures for assistive tech. */}
      <table className="sr-only">
        <caption>{weekly ? t("chart.captionWeekly") : t("chart.captionDaily")}</caption>
        <thead>
          <tr>
            <th scope="col">{weekly ? t("chart.week") : t("chart.day")}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.start}>
              <th scope="row">{label(b.start)}</th>
              {series.map((s) => (
                <td key={s.key}>{formatMoneyWhole(b[s.key], currency)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
