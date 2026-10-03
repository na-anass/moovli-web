"use client";

import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatMoneyWhole } from "@/lib/money";

/**
 * Where the period's revenue came from. Same colours and vocabulary as the
 * per-day chart beside it, with the total in the middle and the exact figures
 * listed underneath — the list, not the ring, is what people actually read.
 */
export function RevenueSplitDonut({
  direct,
  marketplace,
  other,
  currency,
}: {
  direct: number;
  marketplace: number;
  other: number;
  currency: string;
}) {
  const t = useTranslations("studioMain.insights");
  const total = direct + marketplace + other;

  const slices = [
    { key: "direct", value: direct, color: "var(--chart-1)", name: t("sources.direct") },
    {
      key: "marketplace",
      value: marketplace,
      color: "var(--chart-2)",
      name: t("sources.marketplace"),
    },
    // Only when channel-less bookings actually exist.
    ...(other > 0
      ? [{ key: "other", value: other, color: "var(--muted-foreground)", name: t("sources.other") }]
      : []),
  ];

  if (total === 0) {
    return <p className="py-8 text-sm text-muted-foreground">{t("noRevenue")}</p>;
  }

  return (
    <div>
      <div className="relative mx-auto" style={{ width: 170, height: 170 }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              innerRadius={54}
              outerRadius={82}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold tabular-nums">
            {formatMoneyWhole(total, currency)}
          </span>
          <span className="text-[11px] text-muted-foreground">{t("chart.total")}</span>
        </div>
      </div>

      <ul className="mt-5 space-y-2.5">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className="font-medium">{s.name}</span>
            <span className="ml-auto font-semibold tabular-nums">
              {formatMoneyWhole(s.value, currency)}
            </span>
            <span className="w-10 text-right text-xs font-medium tabular-nums text-muted-foreground">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
