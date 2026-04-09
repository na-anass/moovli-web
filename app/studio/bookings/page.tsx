"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircleIcon, FilterIcon } from "lucide-react";

interface Booking {
  id: string;
  user_id: string;
  status: string;
  credits_cost: number;
  checked_in_at: string | null;
  booking_date: string;
  created_at: string;
  notes: string | null;
  special_requests: string | null;
  qr_code: string;
  service?: { id: string; name: string };
  session?: {
    start_time: string;
    end_time: string;
    provider?: { name: string };
  };
}

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  checked_in: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  no_show: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  waitlist: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const STATUS_OPTIONS = ["all", "confirmed", "checked_in", "completed", "cancelled", "no_show", "pending", "waitlist"];

export default function BookingsPage() {
  const { roles } = useAuth();
  const [data, setData] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  const entityId = roles?.ownedEntities?.[0]?.entityId;

  const fetchBookings = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await studioApi.getBookings(entityId, params);
      setData(res.data);
      setTotal(res.pagination.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId, page, statusFilter]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleCheckin = async (bookingId: string) => {
    if (!entityId) return;
    setCheckingIn(bookingId);
    try {
      await studioApi.checkinBooking(entityId, bookingId);
      setData((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: "checked_in", checked_in_at: new Date().toISOString() }
            : b
        )
      );
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingIn(null);
    }
  };

  const columns: Column<Booking>[] = [
    {
      header: "Service",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.service?.name || "N/A"}</p>
          {row.session?.provider?.name && (
            <p className="text-xs text-muted-foreground">{row.session.provider.name}</p>
          )}
        </div>
      ),
    },
    {
      header: "Session Time",
      cell: (row) =>
        row.session?.start_time ? (
          <div className="text-sm">
            <p>{new Date(row.session.start_time).toLocaleDateString()}</p>
            <p className="text-muted-foreground">
              {new Date(row.session.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {" — "}
              {new Date(row.session.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        ),
    },
    {
      header: "Status",
      cell: (row) => (
        <Badge variant="outline" className={statusColors[row.status] || ""}>
          {row.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      header: "Credits",
      cell: (row) => (
        <span className="font-medium">{row.credits_cost || 0}</span>
      ),
    },
    {
      header: "Booked",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: "",
      cell: (row) =>
        row.status === "confirmed" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCheckin(row.id)}
            disabled={checkingIn === row.id}
            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950"
          >
            <CheckCircleIcon className="size-4 mr-1.5" />
            {checkingIn === row.id ? "..." : "Check In"}
          </Button>
        ) : row.status === "checked_in" ? (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircleIcon className="size-3.5" />
            {row.checked_in_at
              ? new Date(row.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Checked in"}
          </span>
        ) : null,
    },
  ];

  // Count by status for quick stats
  const confirmedCount = data.filter((b) => b.status === "confirmed").length;
  const checkedInCount = data.filter((b) => b.status === "checked_in").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} total bookings</p>
        </div>
      </div>

      {/* Quick stats + filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Confirmed: <span className="font-medium text-foreground">{confirmedCount}</span>
          </span>
          <span className="text-muted-foreground">
            Checked In: <span className="font-medium text-emerald-600">{checkedInCount}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <FilterIcon className="size-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All statuses" : s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
