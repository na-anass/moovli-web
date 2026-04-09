"use client";

import { useEffect, useState } from "react";
import { StatsCard } from "@/components/shared/stats-card";
import { studioApi, type StudioDashboardMetrics } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  CalendarIcon,
  UsersIcon,
  TrendingUpIcon,
  ClockIcon,
  PlusIcon,
  ArrowRightIcon,
  BookOpenIcon,
} from "lucide-react";

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  capacity: number;
  booked_count: number;
  service?: { name: string };
  provider?: { name: string };
}

export default function StudioDashboardPage() {
  const { roles } = useAuth();
  const [metrics, setMetrics] = useState<StudioDashboardMetrics | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const entityId = roles?.ownedEntities?.[0]?.entityId;

  useEffect(() => {
    if (!entityId) return;
    Promise.all([
      studioApi.getDashboard(entityId),
      studioApi.getSessions(entityId, { page: 1, limit: 5 }),
    ])
      .then(([dashRes, sessRes]) => {
        setMetrics(dashRes.data);
        setSessions(sessRes.data);
      })
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
        <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
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
      {/* Header with quick actions */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/studio/schedule">
            <Button variant="outline" size="sm">
              <PlusIcon className="size-4 mr-1.5" />
              New Session
            </Button>
          </Link>
          <Link href="/studio/instructors">
            <Button variant="outline" size="sm">
              <UsersIcon className="size-4 mr-1.5" />
              Add Instructor
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
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

      {/* Upcoming Sessions */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-5 text-primary" />
            <h2 className="font-semibold">Upcoming Sessions</h2>
          </div>
          <Link href="/studio/schedule">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRightIcon className="size-4 ml-1" />
            </Button>
          </Link>
        </div>
        {sessions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">No upcoming sessions.</p>
            <Link href="/studio/schedule">
              <Button variant="outline" size="sm" className="mt-3">
                <PlusIcon className="size-4 mr-1.5" />
                Create Session
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[50px]">
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.start_time).toLocaleDateString("en-US", { weekday: "short" })}
                    </p>
                    <p className="text-lg font-bold">
                      {new Date(s.start_time).getDate()}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">{s.service?.name || "Session"}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" — "}
                      {new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {s.provider?.name && ` · ${s.provider.name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    <span className="font-medium">{s.booked_count}</span>
                    <span className="text-muted-foreground">/{s.capacity}</span>
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      s.status === "available"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : s.status === "full"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                          : ""
                    }
                  >
                    {s.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/studio/bookings" className="group">
          <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all">
            <BookOpenIcon className="size-5 text-primary mb-3" />
            <h3 className="font-semibold group-hover:text-primary transition-colors">Manage Bookings</h3>
            <p className="text-sm text-muted-foreground mt-1">Check in attendees and manage reservations</p>
          </div>
        </Link>
        <Link href="/studio/instructors" className="group">
          <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all">
            <UsersIcon className="size-5 text-primary mb-3" />
            <h3 className="font-semibold group-hover:text-primary transition-colors">Instructors</h3>
            <p className="text-sm text-muted-foreground mt-1">Add and manage your teaching team</p>
          </div>
        </Link>
        <Link href="/studio/settings" className="group">
          <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all">
            <ClockIcon className="size-5 text-primary mb-3" />
            <h3 className="font-semibold group-hover:text-primary transition-colors">Studio Settings</h3>
            <p className="text-sm text-muted-foreground mt-1">Update profile, hours, and contact info</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
