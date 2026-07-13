"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { StatsCard } from "@/components/shared/stats-card";
import { InfoTip } from "@/components/ui/info-tip";
import { adminApi } from "@/lib/api/admin";
import {
  UsersIcon,
  CalendarIcon,
  BuildingIcon,
  CoinsIcon,
} from "lucide-react";

interface AnalyticsOverview {
  totalUsers: number;
  totalBookings: number;
  activeStudios: number;
  totalCreditsEarned: number;
}

interface TrendPoint {
  date: string;
  bookings: number;
}

interface TopStudio {
  entityId: string;
  name: string;
  bookings: number;
}

export default function AnalyticsPage() {
  const t = useTranslations("admin");
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [topStudios, setTopStudios] = useState<TopStudio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.getAnalyticsOverview(),
      adminApi.getAnalyticsTrends(30),
      adminApi.getTopStudios(5),
    ])
      .then(([overviewRes, trendsRes, studiosRes]) => {
        setOverview(overviewRes.data);
        setTrends(trendsRes.data);
        setTopStudios(studiosRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("analytics.title")}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5">
        <h1 className="text-2xl font-bold">{t("analytics.title")}</h1>
        <InfoTip term="analytics" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={t("analytics.totalUsers")}
          value={overview?.totalUsers ?? 0}
          icon={<UsersIcon className="size-5" />}
        />
        <StatsCard
          title={t("analytics.totalBookings")}
          value={overview?.totalBookings ?? 0}
          icon={<CalendarIcon className="size-5" />}
        />
        <StatsCard
          title={t("analytics.activeStudios")}
          value={overview?.activeStudios ?? 0}
          icon={<BuildingIcon className="size-5" />}
        />
        <StatsCard
          title={t("analytics.creditsEarned")}
          value={overview?.totalCreditsEarned ?? 0}
          icon={<CoinsIcon className="size-5" />}
        />
      </div>

      {/* Booking Trends */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">{t("analytics.bookingTrends")}</h2>
        {trends.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("analytics.noBookingData")}</p>
        ) : (
          <div className="space-y-2">
            {trends.slice(-10).map((point) => (
              <div key={point.date} className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground w-24">{point.date}</span>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{
                      width: `${Math.min(
                        (point.bookings / Math.max(...trends.map((t) => t.bookings))) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
                <span className="font-medium w-8 text-right">{point.bookings}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Studios */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">{t("analytics.topStudios")}</h2>
        {topStudios.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("analytics.noData")}</p>
        ) : (
          <div className="space-y-3">
            {topStudios.map((studio, i) => (
              <div
                key={studio.entityId}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="font-medium">{studio.name}</span>
                </div>
                <span className="text-muted-foreground">
                  {t("analytics.bookingsCount", { count: studio.bookings })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
