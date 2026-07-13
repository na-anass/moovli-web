"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { StatsCard } from "@/components/shared/stats-card";
import { InfoTip } from "@/components/ui/info-tip";
import { adminApi, type DashboardMetrics } from "@/lib/api/admin";
import {
  UsersIcon,
  BuildingIcon,
  CalendarIcon,
  CoinsIcon,
} from "lucide-react";

export default function AdminDashboardPage() {
  const t = useTranslations("admin");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getDashboard()
      .then((res) => setMetrics(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <InfoTip term="analytics" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={t("dashboard.totalUsers")}
          value={metrics?.totalUsers ?? 0}
          icon={<UsersIcon className="size-5" />}
          description={t("dashboard.totalUsersDesc")}
        />
        <StatsCard
          title={t("dashboard.activeStudios")}
          value={metrics?.activeStudios ?? 0}
          icon={<BuildingIcon className="size-5" />}
          description={t("dashboard.activeStudiosDesc")}
        />
        <StatsCard
          title={t("dashboard.bookingsThisWeek")}
          value={metrics?.bookingsThisWeek ?? 0}
          icon={<CalendarIcon className="size-5" />}
          description={t("dashboard.bookingsThisWeekDesc")}
        />
        <StatsCard
          title={t("dashboard.creditsEarned")}
          value={metrics?.creditsThisMonth ?? 0}
          icon={<CoinsIcon className="size-5" />}
          description={t("dashboard.creditsEarnedDesc")}
        />
      </div>
    </div>
  );
}
