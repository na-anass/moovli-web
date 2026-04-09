"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { Badge } from "@/components/ui/badge";

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  status: string;
  service?: { name: string };
  provider?: { name: string };
}

const statusColors: Record<string, string> = {
  available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  full: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

export default function SchedulePage() {
  const { roles } = useAuth();
  const [data, setData] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const entityId = roles?.ownedEntities?.[0]?.entityId;

  const fetchSessions = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await studioApi.getSessions(entityId, { page });
      setData(res.data);
      setTotal(res.pagination.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId, page]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const columns: Column<Session>[] = [
    {
      header: "Service",
      cell: (row) => <span>{row.service?.name || "N/A"}</span>,
    },
    {
      header: "Instructor",
      cell: (row) => <span>{row.provider?.name || "N/A"}</span>,
    },
    {
      header: "Start Time",
      cell: (row) =>
        row.start_time
          ? new Date(row.start_time).toLocaleString()
          : "N/A",
    },
    {
      header: "Capacity",
      cell: (row) => (
        <span>
          {row.booked_count ?? 0}/{row.capacity ?? 0}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (row) => (
        <Badge variant="outline" className={statusColors[row.status] || ""}>
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-sm text-muted-foreground">{total} sessions</p>
      </div>

      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        isLoading={loading}
      />
    </div>
  );
}
