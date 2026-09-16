"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BaseLayout } from "@/components/layout/base-layout";
import { StatsCard } from "@/components/shared/stats-card";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { BookingsColumnChart } from "@/components/shared/bookings-column-chart";
import { InfoTip } from "@/components/ui/info-tip";
import { studioApi, type StudioInsights } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import {
  isRangeComplete,
  parseDateRange,
  serializeDateRange,
  type DateRange,
} from "@/lib/date-range";
import {
  CalendarIcon,
  UserXIcon,
  XCircleIcon,
  PercentIcon,
} from "lucide-react";

// useSearchParams needs a Suspense boundary in the App Router.
export default function InsightsPage() {
  return (
    <Suspense fallback={null}>
      <Insights />
    </Suspense>
  );
}

function Insights() {
  const t = useTranslations("studioMain");
  const activeEntity = useActiveEntity();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [insights, setInsights] = useState<StudioInsights | null>(null);
  // Key of the entity+range currently shown; while it differs from the request,
  // the content is dimmed instead of blanked.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const entityId = activeEntity.entityId;

  // Selected period lives in the URL (?range=90d / ?range=custom&from=&to=).
  const searchKey = searchParams.toString();
  const range = useMemo(() => parseDateRange(new URLSearchParams(searchKey), "30d"), [searchKey]);

  const setRange = (next: DateRange) => {
    const params = serializeDateRange(next, new URLSearchParams(searchKey));
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  const requestKey = `${entityId}|${range.from}|${range.to}`;
  const loading = loadedKey === null;
  const refreshing = !loading && loadedKey !== requestKey;

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    studioApi
      .getInsights(entityId, { from: range.from, to: range.to })
      .then((res) => {
        if (!cancelled) setInsights(res.data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoadedKey(`${entityId}|${range.from}|${range.to}`);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId, range.from, range.to]);

  const filter = <DateRangeFilter value={range} onChange={setRange} />;

  if (loading) {
    return (
      <BaseLayout maxWidth="full" title={t("insights.title")} action={filter}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-xl border border-border bg-card animate-pulse" />
      </BaseLayout>
    );
  }

  const total = insights?.totalBookings ?? 0;
  const previousTotal = insights?.previousTotalBookings ?? 0;
  // Compare with the previous period only once the selected one has finished.
  const rangeComplete = isRangeComplete(range);
  const totalChange =
    rangeComplete && previousTotal > 0
      ? Math.round(((total - previousTotal) / previousTotal) * 100)
      : 0;
  const daily = insights?.daily ?? [];

  return (
    <BaseLayout maxWidth="full" title={t("insights.title")} action={filter}>
      <div
        className={`flex flex-col gap-4 transition-opacity ${refreshing ? "opacity-60" : ""}`}
        aria-busy={refreshing}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title={t("insights.stats.totalBookings")}
            value={total}
            icon={<CalendarIcon className="size-5" />}
            trend={totalChange !== 0 ? { value: totalChange, isPositive: totalChange > 0 } : undefined}
            description={
              rangeComplete ? t("insights.stats.vsPreviousPeriod") : t("insights.stats.periodInProgress")
            }
            tooltip={t("insights.stats.totalBookingsTip")}
          />
          <StatsCard
            title={t("insights.stats.cancelled")}
            value={insights?.cancelledCount ?? 0}
            icon={<XCircleIcon className="size-5" />}
            description={t("insights.stats.cancelledDesc")}
            tooltip={t("insights.stats.cancelledTip")}
          />
          <StatsCard
            title={t("insights.stats.cancellationRate")}
            value={`${(insights?.cancellationRate ?? 0).toFixed(1)}%`}
            icon={<PercentIcon className="size-5" />}
            description={
              rangeComplete && previousTotal > 0
                ? t("insights.stats.previousRate", {
                    rate: (insights?.previousCancellationRate ?? 0).toFixed(1),
                  })
                : t("insights.stats.cancellationRateDesc")
            }
            tooltip={t("insights.stats.cancellationRateTip")}
          />
          <StatsCard
            title={t("insights.stats.noShows")}
            value={insights?.noShowCount ?? 0}
            icon={<UserXIcon className="size-5" />}
            description={t("insights.stats.noShowsDesc")}
            tooltip={t("insights.stats.noShowsTip")}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-1.5">
            {t("insights.bookingsOverTime")}
            <InfoTip term="analytics" />
          </h2>
          {total === 0 ? (
            <p className="text-muted-foreground text-sm">{t("insights.noData")}</p>
          ) : (
            <BookingsColumnChart daily={daily} />
          )}
        </div>
      </div>
    </BaseLayout>
  );
}
