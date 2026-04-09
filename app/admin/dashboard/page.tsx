"use client";

import { useEffect, useState } from "react";
import { StatsCard } from "@/components/shared/stats-card";
import { adminApi, type DashboardMetrics } from "@/lib/api/admin";
import {
  UsersIcon,
  BuildingIcon,
  CalendarIcon,
  CoinsIcon,
} from "lucide-react";

export default function AdminDashboardPage() {
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
        <h1 className="text-2xl font-bold">Dashboard</h1>
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
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Users"
          value={metrics?.totalUsers ?? 0}
          icon={<UsersIcon className="size-5" />}
          description="All registered users"
        />
        <StatsCard
          title="Active Studios"
          value={metrics?.activeStudios ?? 0}
          icon={<BuildingIcon className="size-5" />}
          description="Active entities on platform"
        />
        <StatsCard
          title="Bookings This Week"
          value={metrics?.bookingsThisWeek ?? 0}
          icon={<CalendarIcon className="size-5" />}
          description="Last 7 days"
        />
        <StatsCard
          title="Credits Earned"
          value={metrics?.creditsThisMonth ?? 0}
          icon={<CoinsIcon className="size-5" />}
          description="Last 30 days"
        />
      </div>
    </div>
  );
}
