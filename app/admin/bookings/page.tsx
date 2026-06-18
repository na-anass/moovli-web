"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { adminApi } from "@/lib/api/admin";
import { Badge } from "@/components/ui/badge";

interface Booking {
  id: string;
  user_id: string;
  entity_id: string;
  status: string;
  credits_cost: number;
  booking_date: string;
  created_at: string;
  entity?: { name: string };
  service?: { name: string };
  session?: { start_time: string; end_time: string };
}

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  no_show: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export default function BookingsPage() {
  const [data, setData] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getBookings({
        page,
        limit: 20,
        status: status === "all" ? undefined : status,
      });
      setData(res.data);
      setTotal(res.pagination.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const columns: Column<Booking>[] = [
    {
      header: "Studio",
      cell: (row) => <span>{row.entity?.name || "N/A"}</span>,
    },
    {
      header: "Service",
      cell: (row) => <span>{row.service?.name || "N/A"}</span>,
    },
    {
      header: "Status",
      cell: (row) => (
        <Badge variant="outline" className={statusColors[row.status] || ""}>
          {row.status}
        </Badge>
      ),
    },
    {
      header: "Credits",
      cell: (row) => <span className="font-medium">{row.credits_cost || 0}</span>,
    },
    {
      header: "Session Time",
      cell: (row) =>
        row.session?.start_time
          ? new Date(row.session.start_time).toLocaleString()
          : "N/A",
    },
    {
      header: "Booked",
      cell: (row) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <p className="text-sm text-muted-foreground">{total} total</p>
      </div>

      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        filters={[
          {
            label: "Status",
            value: status,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
            options: [
              { label: "All statuses", value: "all" },
              { label: "Confirmed", value: "confirmed" },
              { label: "Pending", value: "pending" },
              { label: "Cancelled", value: "cancelled" },
              { label: "Completed", value: "completed" },
              { label: "No show", value: "no_show" },
            ],
          },
        ]}
        isLoading={loading}
      />
    </div>
  );
}
