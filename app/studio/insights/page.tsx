"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BaseLayout } from "@/components/layout/base-layout";
import { StatsCard } from "@/components/shared/stats-card";
import { InfoTip } from "@/components/ui/info-tip";
import { studioApi } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import {
  CalendarIcon,
  XCircleIcon,
  PercentIcon,
} from "lucide-react";

interface InsightsData {
  totalBookings: number;
  cancelledCount: number;
  cancellationRate: number;
  dailyBreakdown?: { date: string; bookings: number }[];
}

export default function InsightsPage() {
  const t = useTranslations("studioMain");
  const activeEntity = useActiveEntity();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  const entityId = activeEntity.entityId;

  useEffect(() => {
    if (!entityId) return;
    studioApi
      .getInsights(entityId, 30)
      .then((res) => setInsights(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityId]);

  if (loading) {
    return (
      <BaseLayout maxWidth="full" title={t("insights.title")}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      </BaseLayout>
    );
  }

  const daily = insights?.dailyBreakdown ?? [];
  const maxBookings = Math.max(...daily.map((d) => d.bookings), 1);

  return (
    <BaseLayout maxWidth="full" title={t("insights.title")}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title={t("insights.stats.totalBookings")}
          value={insights?.totalBookings ?? 0}
          icon={<CalendarIcon className="size-5" />}
          description={t("insights.stats.last30Days")}
        />
        <StatsCard
          title={t("insights.stats.cancelled")}
          value={insights?.cancelledCount ?? 0}
          icon={<XCircleIcon className="size-5" />}
          description={t("insights.stats.cancelledDesc")}
        />
        <StatsCard
          title={t("insights.stats.cancellationRate")}
          value={`${(insights?.cancellationRate ?? 0).toFixed(1)}%`}
          icon={<PercentIcon className="size-5" />}
          description={t("insights.stats.ofTotalBookings")}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-1.5">
          {t("insights.dailyBookings")}
          <InfoTip term="analytics" />
        </h2>
        {daily.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("insights.noData")}</p>
        ) : (
          <div className="space-y-2">
            {daily.slice(-10).map((point) => (
              <div key={point.date} className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground w-24">{point.date}</span>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{
                      width: `${Math.min((point.bookings / maxBookings) * 100, 100)}%`,
                    }}
                  />
                </div>
                <span className="font-medium w-8 text-right">{point.bookings}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseLayout>
  );
}
