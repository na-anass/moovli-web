"use client";

import { useEffect, useState } from "react";
import { instructorApi } from "@/lib/api/instructor";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function InstructorDashboardPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      instructorApi.getMyProfile(),
      instructorApi.getSessions({ page: 1, limit: 10 }),
    ])
      .then(([profileRes, sessionsRes]) => {
        setProfiles(profileRes.data);
        setSessions(sessionsRes.data);
        setTotal(sessionsRes.pagination.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="h-32 rounded-xl border border-border bg-card animate-pulse" />
        <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
      </div>
    );
  }

  const columns: Column<any>[] = [
    {
      header: "Service",
      cell: (row) => <span className="font-medium">{row.service?.name || "N/A"}</span>,
    },
    {
      header: "Studio",
      cell: (row) => <span>{row.entity?.name || "N/A"}</span>,
    },
    {
      header: "Time",
      cell: (row) => new Date(row.start_time).toLocaleString(),
    },
    {
      header: "Capacity",
      cell: (row) => (
        <span>
          {row.booked_count}/{row.capacity}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (row) => (
        <Badge
          variant="outline"
          className={
            row.status === "available"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      header: "",
      cell: (row) => (
        <Link href={`/instructor/sessions/${row.id}`}>
          <Button variant="ghost" size="sm">
            Attendees
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Profile summary */}
      {profiles.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-3">My Profiles</h2>
          <div className="space-y-2">
            {profiles.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                    {p.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <span className="font-medium">{p.name}</span>
                    {p.entity && (
                      <span className="text-muted-foreground ml-2">at {p.entity.name}</span>
                    )}
                  </div>
                </div>
                <Badge variant="outline">{p.tier || "standard"}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming sessions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Upcoming Sessions ({total})
        </h2>
        <DataTable columns={columns} data={sessions} total={total} />
      </div>
    </div>
  );
}
