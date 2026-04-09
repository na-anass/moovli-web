"use client";

import { useEffect, useState } from "react";
import { StatsCard } from "@/components/shared/stats-card";
import { studioApi, type StudioDashboardMetrics } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import {
  CalendarIcon,
  UsersIcon,
  TrendingUpIcon,
  ClockIcon,
} from "lucide-react";

export default function StudioDashboardPage() {
  const { roles } = useAuth();
  const [metrics, setMetrics] = useState<StudioDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const entityId = roles?.ownedEntities?.[0]?.entityId;

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
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const weekChange =
    metrics && metrics.bookingsLastWeek > 0
      ? Math.round(
          ((metrics.bookingsThisWeek - metrics.bookingsLastWeek) /
            metrics.bookingsLastWeek) *
            100
        )
      : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Bookings This Week"
          value={metrics?.bookingsThisWeek ?? 0}
          icon={<CalendarIcon className="size-5" />}
          trend={weekChange !== 0 ? { value: weekChange, isPositive: weekChange > 0 } : undefined}
          description="vs last week"
        />
        <StatsCard
          title="Last Week"
          value={metrics?.bookingsLastWeek ?? 0}
          icon={<TrendingUpIcon className="size-5" />}
          description="Previous 7 days"
        />
        <StatsCard
          title="Unique Members"
          value={metrics?.uniqueMembers ?? 0}
          icon={<UsersIcon className="size-5" />}
          description="All time"
        />
        <StatsCard
          title="Active Sessions"
          value={metrics?.activeSessions ?? 0}
          icon={<ClockIcon className="size-5" />}
          description="Available or full"
        />
      </div>
    </div>
  );
}
