"use client";

import { useEffect, useState } from "react";
import { StatsCard } from "@/components/shared/stats-card";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import {
  CalendarIcon,
  CoinsIcon,
  XCircleIcon,
  PercentIcon,
} from "lucide-react";

interface InsightsData {
  totalBookings: number;
  totalCredits: number;
  cancelledCount: number;
  cancellationRate: number;
  dailyBreakdown?: { date: string; bookings: number }[];
}

export default function InsightsPage() {
  const { roles } = useAuth();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  const entityId = roles?.ownedEntities?.[0]?.entityId;

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
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Insights</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const daily = insights?.dailyBreakdown ?? [];
  const maxBookings = Math.max(...daily.map((d) => d.bookings), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Insights</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Bookings"
          value={insights?.totalBookings ?? 0}
          icon={<CalendarIcon className="size-5" />}
          description="Last 30 days"
        />
        <StatsCard
          title="Total Credits"
          value={insights?.totalCredits ?? 0}
          icon={<CoinsIcon className="size-5" />}
          description="Credits earned"
        />
        <StatsCard
          title="Cancelled"
          value={insights?.cancelledCount ?? 0}
          icon={<XCircleIcon className="size-5" />}
          description="Cancelled bookings"
        />
        <StatsCard
          title="Cancellation Rate"
          value={`${(insights?.cancellationRate ?? 0).toFixed(1)}%`}
          icon={<PercentIcon className="size-5" />}
          description="Of total bookings"
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Daily Bookings (Last 30 Days)</h2>
        {daily.length === 0 ? (
          <p className="text-muted-foreground text-sm">No booking data available.</p>
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
    </div>
  );
}
