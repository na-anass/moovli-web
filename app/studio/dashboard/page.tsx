"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BaseLayout } from "@/components/layout/base-layout";
import { StatsCard } from "@/components/shared/stats-card";
import { SetupChecklist } from "@/components/studio/setup-checklist";
import { studioApi, type StudioDashboardMetrics } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import { formatMoneyWhole } from "@/lib/money";
import { formatTime, formatDateCustom } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CalendarIcon,
  ClockIcon,
  GlobeIcon,
  PlusIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

export default function StudioDashboardPage() {
  const t = useTranslations("studioMain");
  const activeEntity = useActiveEntity();
  const [metrics, setMetrics] = useState<StudioDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const entityId = activeEntity.entityId;
  const currency = activeEntity.currencyCode;

  // Onboarding gate now lives in app/studio/layout.tsx (runs before any studio
  // page paints), so the dashboard no longer needs its own redirect.

  useEffect(() => {
    if (!entityId) return;
    studioApi
      .getDashboard(entityId)
      .then((res) => setMetrics(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityId]);

  if (loading) {
    return (
      <BaseLayout maxWidth="full" title={t("dashboard.title")}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
      </BaseLayout>
    );
  }

  const weekChange =
    metrics && metrics.bookingsLastWeek > 0
      ? Math.round(
          ((metrics.bookingsThisWeek - metrics.bookingsLastWeek) /
            metrics.bookingsLastWeek) *
            100,
        )
      : 0;

  const channels = metrics?.channelSplitLast30Days ?? { marketplace: 0, direct: 0, other: 0 };
  const channelTotal = channels.marketplace + channels.direct;
  const marketplacePct = channelTotal > 0 ? Math.round((channels.marketplace / channelTotal) * 100) : 0;

  const upcoming = metrics?.upcomingSessions ?? [];
  const pendingCount = metrics?.pendingDirectBookings ?? 0;

  return (
    <BaseLayout
      maxWidth="full"
      title={t("dashboard.title")}
      action={
        <>
          <Link href="/studio/schedule">
            <Button variant="outline" size="sm">
              <PlusIcon className="size-4 mr-1.5" />
              {t("dashboard.newSession")}
            </Button>
          </Link>
        </>
      }
    >
      {/* Finish-setting-up checklist (hides itself when complete or dismissed) */}
      {entityId && <SetupChecklist entityId={entityId} />}

      {/* Action-required banner */}
      {pendingCount > 0 && (
        <Link
          href="/studio/bookings"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 hover:bg-amber-100/60 transition-colors group dark:border-amber-700 dark:bg-amber-950/40"
        >
          <div className="flex items-center gap-3">
            <AlertCircleIcon className="size-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                {t("dashboard.pendingBanner", { count: pendingCount })}
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                {t("dashboard.pendingBannerSub")}
              </p>
            </div>
          </div>
          <ArrowRightIcon className="size-4 text-amber-700 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}

      {/* Stats — 4 columns: revenue, bookings, members, active sessions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={t("dashboard.stats.marketplaceRevenue")}
          value={formatMoneyWhole(metrics?.revenueMadThisWeek ?? 0, currency)}
          icon={<WalletIcon className="size-5" />}
          description={t("dashboard.stats.last7Days")}
        />
        <StatsCard
          title={t("dashboard.stats.bookingsThisWeek")}
          value={metrics?.bookingsThisWeek ?? 0}
          icon={<CalendarIcon className="size-5" />}
          trend={weekChange !== 0 ? { value: weekChange, isPositive: weekChange > 0 } : undefined}
          description={t("dashboard.stats.vsLastWeek")}
        />
        <StatsCard
          title={t("dashboard.stats.uniqueMembers")}
          value={metrics?.uniqueMembers ?? 0}
          icon={<UsersIcon className="size-5" />}
          description={t("dashboard.stats.allTime")}
        />
        <StatsCard
          title={t("dashboard.stats.activeSessions")}
          value={metrics?.activeSessions ?? 0}
          icon={<ClockIcon className="size-5" />}
          description={t("dashboard.stats.availableOrFull")}
        />
      </div>

      {/* Two-column: Upcoming sessions + Channel mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upcoming (2/3 width) */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <CalendarIcon className="size-5 text-primary" />
              <h2 className="font-semibold">{t("dashboard.next24Hours")}</h2>
            </div>
            <Link href="/studio/schedule">
              <Button variant="ghost" size="sm">
                {t("dashboard.viewSchedule")}
                <ArrowRightIcon className="size-4 ml-1" />
              </Button>
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">{t("dashboard.noUpcoming")}</p>
              <Link href="/studio/schedule">
                <Button variant="outline" size="sm" className="mt-3">
                  <PlusIcon className="size-4 mr-1.5" />
                  {t("dashboard.createSession")}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {upcoming.map((s) => {
                const start = new Date(s.start_time);
                const end = new Date(s.end_time);
                const isToday = start.toDateString() === new Date().toDateString();
                const fillPct = s.capacity > 0 ? Math.min(100, Math.round((s.booked_count / s.capacity) * 100)) : 0;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="text-center min-w-12 shrink-0">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {isToday ? t("dashboard.today") : formatDateCustom(start, { weekday: "short" })}
                        </p>
                        <p className="text-lg font-bold leading-tight">
                          {formatTime(start)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.service?.name ?? t("dashboard.sessionFallback")}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatTime(start)}
                          {" — "}
                          {formatTime(end)}
                          {s.provider?.name ? ` · ${s.provider.name}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm tabular-nums">
                          <span className="font-semibold">{s.booked_count}</span>
                          <span className="text-muted-foreground">/{s.capacity}</span>
                        </p>
                        <div className="mt-0.5 h-1 w-16 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              fillPct >= 100
                                ? "bg-amber-500"
                                : fillPct >= 80
                                  ? "bg-emerald-500"
                                  : "bg-primary/60"
                            }`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          s.status === "available"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px]"
                            : s.status === "full"
                              ? "border-amber-300 bg-amber-50 text-amber-700 text-[10px]"
                              : "text-[10px]"
                        }
                      >
                        {t.has(`dashboard.sessionStatus.${s.status}`)
                          ? t(`dashboard.sessionStatus.${s.status}`)
                          : s.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Channel mix (1/3 width) */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUpIcon className="size-5 text-primary" />
            <h2 className="font-semibold">{t("dashboard.channelMix")}</h2>
            <span className="ml-auto text-[10px] text-muted-foreground">{t("dashboard.last30Days")}</span>
          </div>

          {channelTotal === 0 ? (
            <p className="text-xs text-muted-foreground py-4">{t("dashboard.noBookings30")}</p>
          ) : (
            <div className="space-y-4">
              {/* Marketplace */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <ShoppingBagIcon className="size-3.5 text-violet-600" />
                    <span>{t("dashboard.marketplace")}</span>
                  </div>
                  <span className="tabular-nums text-muted-foreground">
                    <span className="font-semibold text-foreground">{channels.marketplace}</span>{" "}
                    · {marketplacePct}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-violet-500" style={{ width: `${marketplacePct}%` }} />
                </div>
              </div>

              {/* Direct */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <GlobeIcon className="size-3.5 text-emerald-600" />
                    <span>{t("dashboard.directPage")}</span>
                  </div>
                  <span className="tabular-nums text-muted-foreground">
                    <span className="font-semibold text-foreground">{channels.direct}</span>{" "}
                    · {100 - marketplacePct}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${100 - marketplacePct}%` }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t text-xs text-muted-foreground">
                {t("dashboard.totalBookings30", { count: channelTotal })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/studio/bookings" className="group">
          <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-all">
            <BookOpenIcon className="size-5 text-primary mb-3" />
            <h3 className="font-semibold group-hover:text-primary transition-colors">{t("dashboard.quickLinks.manageBookings")}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t("dashboard.quickLinks.manageBookingsDesc")}</p>
          </div>
        </Link>
        <Link href="/studio/services" className="group">
          <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-all">
            <ClockIcon className="size-5 text-primary mb-3" />
            <h3 className="font-semibold group-hover:text-primary transition-colors">{t("dashboard.quickLinks.servicesPricing")}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t("dashboard.quickLinks.servicesPricingDesc")}</p>
          </div>
        </Link>
        <Link href="/studio/customers" className="group">
          <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-all">
            <UsersIcon className="size-5 text-primary mb-3" />
            <h3 className="font-semibold group-hover:text-primary transition-colors">{t("dashboard.quickLinks.customers")}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t("dashboard.quickLinks.customersDesc")}</p>
          </div>
        </Link>
      </div>
    </BaseLayout>
  );
}
