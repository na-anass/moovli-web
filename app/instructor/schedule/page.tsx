"use client";

import { useEffect, useState } from "react";
import { formatTime, formatDateFull } from "@/lib/datetime";
import { instructorApi } from "@/lib/api/instructor";

interface ScheduleItem {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  capacity: number;
  booked_count: number;
  service?: { name: string; duration_minutes: number };
  entity?: { name: string; city: string };
}

export default function InstructorSchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    instructorApi
      .getSchedule(now.toISOString(), thirtyDaysLater.toISOString())
      .then((res) => setSchedule(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Schedule</h1>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Group by date
  const grouped: Record<string, ScheduleItem[]> = {};
  schedule.forEach((item) => {
    const date = item.start_time.substring(0, 10);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(item);
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Schedule</h1>
      <p className="text-muted-foreground">Next 30 days — {schedule.length} sessions</p>

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No upcoming sessions.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                {formatDateFull(items[0].start_time)}
              </h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <p className="text-sm font-bold">
                          {formatTime(item.start_time)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.service?.duration_minutes || "?"}min
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">{item.service?.name || "Session"}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.entity?.name} — {item.entity?.city}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {item.booked_count}/{item.capacity} booked
                      </p>
                      <p className="text-xs text-muted-foreground">{item.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
