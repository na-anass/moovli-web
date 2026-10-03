"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarIcon,
  CoinsIcon,
  LightbulbIcon,
  ShoppingBagIcon,
  UserXIcon,
  XCircleIcon,
} from "lucide-react";
import { BaseLayout } from "@/components/layout/base-layout";
import { StatsCard } from "@/components/shared/stats-card";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ExportMenu } from "@/components/shared/export-menu";
import { InfoTip } from "@/components/ui/info-tip";
import { RevenueChart } from "@/components/studio/insights/revenue-chart";
import { RevenueSplitDonut } from "@/components/studio/insights/revenue-split-donut";
import { FillHeatmap } from "@/components/studio/insights/fill-heatmap";
import { ServicesTable } from "@/components/studio/insights/services-table";
import { studioApi, type StudioInsights } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import { formatMoneyWhole } from "@/lib/money";
import { insightsFilename, type ExportSheet } from "@/lib/export/insights-export";
import {
  isRangeComplete,
  parseDateRange,
  serializeDateRange,
  type DateRange,
} from "@/lib/date-range";

// useSearchParams needs a Suspense boundary in the App Router.
export default function InsightsPage() {
  return (
    <Suspense fallback={null}>
      <Insights />
    </Suspense>
  );
}

function Insights() {
  const t = useTranslations("studioMain.insights");
  const activeEntity = useActiveEntity();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [insights, setInsights] = useState<StudioInsights | null>(null);
  // Key of the entity+range currently shown; while it differs from the request,
  // the content is dimmed rather than blanked.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const entityId = activeEntity.entityId;
  const currency = activeEntity.currencyCode;

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

  // Compare with the previous period only once this one has finished.
  const rangeComplete = isRangeComplete(range);
  const delta = (current: number, previous: number) => {
    if (!rangeComplete || previous <= 0) return undefined;
    const value = Math.round(((current - previous) / previous) * 100);
    return value === 0 ? undefined : { value, isPositive: value > 0 };
  };

  /** Built on click, so an export always matches what is on screen. */
  const buildExport = (): ExportSheet[] => {
    if (!insights) return [];
    return [
      {
        name: t("export.summary"),
        columns: [t("export.metric"), t("export.value")],
        rows: [
          [t("stats.totalBookings"), insights.totalBookings],
          [t("stats.revenue"), insights.revenue],
          [t("stats.averageBasket"), insights.averageBasket],
          [t("stats.cancelled"), insights.cancelledCount],
          [t("stats.cancellationRate"), `${insights.cancellationRate}%`],
          [t("stats.noShows"), insights.noShowCount],
          [t("sources.direct"), insights.revenueByChannel.direct],
          [t("sources.marketplace"), insights.revenueByChannel.marketplace],
          [t("fill.rate"), `${insights.fill.rate}%`],
          [t("fill.emptySeats"), insights.fill.emptySeats],
        ],
      },
      {
        name: t("export.perDay"),
        columns: [
          t("export.date"),
          t("sources.direct"),
          t("sources.marketplace"),
          t("stats.totalBookings"),
          t("stats.cancelled"),
        ],
        rows: insights.dailyRevenue.map((day, i) => [
          day.date,
          day.direct,
          day.marketplace,
          insights.daily[i]?.bookings ?? 0,
          insights.daily[i]?.cancelled ?? 0,
        ]),
      },
      {
        name: t("export.perService"),
        columns: [
          t("services.service"),
          t("services.sessions"),
          t("services.bookings"),
          t("services.fill"),
          t("services.revenue"),
          t("sources.marketplace"),
        ],
        rows: insights.services.map((service) => [
          service.name,
          service.sessions,
          service.bookings,
          service.capacity > 0 ? `${Math.round((service.booked / service.capacity) * 100)}%` : "0%",
          service.revenue,
          service.listedOnMarketplace ? t("services.listed") : t("services.notListed"),
        ]),
      },
    ];
  };

  const actions = (
    <>
      <DateRangeFilter value={range} onChange={setRange} />
      <ExportMenu
        build={buildExport}
        filename={insightsFilename(activeEntity.entityName ?? "studio", range.from, range.to)}
        disabled={!insights}
      />
    </>
  );

  if (loading) {
    return (
      <BaseLayout maxWidth="full" title={t("title")} action={actions}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl border border-border bg-card" />
      </BaseLayout>
    );
  }

  const emptySeats = insights?.fill.emptySeats ?? 0;
  const quietSlots = findQuietSlots(insights);

  return (
    <BaseLayout maxWidth="full" title={t("title")} action={actions}>
      <div
        className={`flex flex-col gap-4 transition-opacity ${refreshing ? "opacity-60" : ""}`}
        aria-busy={refreshing}
      >
        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatsCard
            title={t("stats.totalBookings")}
            value={insights?.totalBookings ?? 0}
            icon={<CalendarIcon className="size-5" />}
            trend={delta(insights?.totalBookings ?? 0, insights?.previousTotalBookings ?? 0)}
            description={rangeComplete ? t("stats.vsPreviousPeriod") : t("stats.periodInProgress")}
            tooltip={t("stats.totalBookingsTip")}
          />
          <StatsCard
            title={t("stats.revenue")}
            value={formatMoneyWhole(insights?.revenue ?? 0, currency)}
            icon={<CoinsIcon className="size-5" />}
            trend={delta(insights?.revenue ?? 0, insights?.previousRevenue ?? 0)}
            description={rangeComplete ? t("stats.vsPreviousPeriod") : t("stats.periodInProgress")}
            tooltip={t("stats.revenueTip")}
          />
          <StatsCard
            title={t("stats.averageBasket")}
            value={formatMoneyWhole(insights?.averageBasket ?? 0, currency)}
            icon={<ShoppingBagIcon className="size-5" />}
            trend={delta(insights?.averageBasket ?? 0, insights?.previousAverageBasket ?? 0)}
            description={t("stats.perBooking")}
            tooltip={t("stats.averageBasketTip")}
          />
          <StatsCard
            title={t("stats.cancelled")}
            value={insights?.cancelledCount ?? 0}
            icon={<XCircleIcon className="size-5" />}
            description={t("stats.rateOfBookings", { rate: insights?.cancellationRate ?? 0 })}
            tooltip={t("stats.cancelledTip")}
          />
          <StatsCard
            title={t("stats.noShows")}
            value={insights?.noShowCount ?? 0}
            icon={<UserXIcon className="size-5" />}
            description={t("stats.rateOfBookings", { rate: insights?.noShowRate ?? 0 })}
            tooltip={t("stats.noShowsTip")}
          />
        </div>

        {/* The number worth acting on, stated plainly — no upsell. */}
        {emptySeats > 0 && <Callout>{t("callouts.emptySeats", { count: emptySeats })}</Callout>}

        {/* ── Revenue ──────────────────────────────────────────────────────── */}
        <SectionLabel>{t("sections.revenue")}</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
            <div className="mb-4">
              <h3 className="flex items-center gap-1.5 font-semibold">
                {t("revenuePerDay")}
                <InfoTip term="analytics" />
              </h3>
              <p className="text-xs text-muted-foreground">{t("revenuePerDaySub")}</p>
            </div>
            <RevenueChart daily={insights?.dailyRevenue ?? []} currency={currency} />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="font-semibold">{t("revenueSplit")}</h3>
              <p className="text-xs text-muted-foreground">{t("revenueSplitSub")}</p>
            </div>
            <RevenueSplitDonut
              direct={insights?.revenueByChannel.direct ?? 0}
              marketplace={insights?.revenueByChannel.marketplace ?? 0}
              other={insights?.revenueByChannel.other ?? 0}
              currency={currency}
            />
          </div>
        </div>

        {/* ── Fill rate ────────────────────────────────────────────────────── */}
        <SectionLabel>{t("sections.fill")}</SectionLabel>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div>
              <h3 className="font-semibold">{t("fill.title")}</h3>
              <p className="text-xs text-muted-foreground">{t("fill.subtitle")}</p>
            </div>
            {(insights?.fill.sessions ?? 0) > 0 && (
              <span className="ml-auto text-sm text-muted-foreground">
                {t("fill.overall", {
                  rate: insights?.fill.rate ?? 0,
                  sessions: insights?.fill.sessions ?? 0,
                })}
              </span>
            )}
          </div>
          <FillHeatmap slots={insights?.fill.slots ?? []} />
          {quietSlots && (
            <Callout className="mt-4">{t("callouts.quietSlots", { slots: quietSlots })}</Callout>
          )}
        </div>

        {/* ── Services ─────────────────────────────────────────────────────── */}
        <SectionLabel>{t("sections.services")}</SectionLabel>
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 p-5 pb-3">
            <div>
              <h3 className="font-semibold">{t("services.title")}</h3>
              <p className="text-xs text-muted-foreground">{t("services.subtitle")}</p>
            </div>
            <span className="ml-auto text-xs text-muted-foreground">
              {t("services.activeCount", { count: insights?.services.length ?? 0 })}
            </span>
          </div>
          <ServicesTable services={insights?.services ?? []} currency={currency} />
        </div>
      </div>
    </BaseLayout>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

function Callout({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 ${className ?? ""}`}
    >
      <LightbulbIcon className="size-5 shrink-0 text-amber-600" />
      <p>{children}</p>
    </div>
  );
}

/**
 * The emptiest recurring slots, as "Mon 13:00 · Tue 13:00".
 * Only slots that ran at least twice, so one quiet class never becomes advice.
 */
function findQuietSlots(insights: StudioInsights | null): string | null {
  if (!insights) return null;
  const candidates = insights.fill.slots
    .filter((slot) => slot.sessions >= 2 && slot.capacity > 0)
    .map((slot) => ({ ...slot, rate: slot.booked / slot.capacity }))
    .filter((slot) => slot.rate < 0.5)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 3);

  if (candidates.length === 0) return null;
  // Short weekday names, locale-independent: the slot label is a coordinate,
  // not prose.
  const WEEKDAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return candidates
    .map((slot) => `${WEEKDAYS[slot.weekday]} ${String(slot.hour).padStart(2, "0")}:00`)
    .join(" · ");
}
