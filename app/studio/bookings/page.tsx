"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { studioApi, type StudioBookingRow } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import {
  CheckIcon,
  ClipboardCheckIcon,
  GlobeIcon,
  ShoppingBagIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type FilterTab = "all" | "pending" | "today" | "marketplace" | "direct";

const STATUS_VARIANT: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  confirmed: { label: "Confirmed", variant: "default" },
  checked_in: { label: "Checked in", variant: "default" },
  completed: { label: "Completed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "outline" },
  no_show: { label: "No-show", variant: "destructive" },
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPrice = (n: number | null) =>
  n != null ? `${Number(n).toFixed(0)} MAD` : "—";

export default function StudioBookingsPage() {
  const { roles } = useAuth();
  const entityId = roles?.ownedEntities?.[0]?.entityId;

  const [tab, setTab] = useState<FilterTab>("all");
  const [bookings, setBookings] = useState<StudioBookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const pageSize = 25;

  const fetchBookings = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const params: Parameters<typeof studioApi.getBookings>[1] = {
        page,
        limit: pageSize,
      };
      if (tab === "pending") params.status = "pending";
      if (tab === "marketplace") params.channel_type = "marketplace";
      if (tab === "direct") params.channel_type = "direct_hosted";

      const res = await studioApi.getBookings(entityId, params);
      let data = res.data;
      let count = res.pagination.total;

      // "today" filter applied client-side
      if (tab === "today") {
        const today = new Date().toISOString().slice(0, 10);
        data = data.filter((b) => (b.booking_date ?? "").slice(0, 10) === today);
        count = data.length;
      }

      setBookings(data);
      setTotal(count);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId, page, tab]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const handleConfirm = async (bookingId: string) => {
    if (!entityId) return;
    setActionLoading(bookingId);
    try {
      await studioApi.confirmBooking(entityId, bookingId);
      await fetchBookings();
    } catch (e) {
      alert((e as Error).message || "Failed to confirm");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (bookingId: string) => {
    if (!entityId) return;
    const reason = prompt("Reason for declining (optional)") ?? undefined;
    if (reason === null) return;
    setActionLoading(bookingId);
    try {
      await studioApi.declineBooking(entityId, bookingId, reason);
      await fetchBookings();
    } catch (e) {
      alert((e as Error).message || "Failed to decline");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckin = async (bookingId: string) => {
    if (!entityId) return;
    setActionLoading(bookingId);
    try {
      await studioApi.checkinBooking(entityId, bookingId);
      await fetchBookings();
    } catch (e) {
      alert((e as Error).message || "Failed to check in");
    } finally {
      setActionLoading(null);
    }
  };

  const columns: Column<StudioBookingRow>[] = [
    {
      header: "Customer",
      cell: (b) => (
        <div className="text-sm">
          <div className="font-medium">{b.user?.name ?? b.guest_name ?? "—"}</div>
          <div className="text-xs text-muted-foreground">
            {b.user?.email ?? b.guest_email ?? "—"}
          </div>
        </div>
      ),
    },
    {
      header: "Session",
      cell: (b) => (
        <div className="text-sm">
          <div>{b.service?.name ?? "Session"}</div>
          <div className="text-xs text-muted-foreground">
            {formatDateTime(b.session?.start_time ?? null)}
          </div>
        </div>
      ),
    },
    {
      header: "Channel",
      cell: (b) =>
        b.channel ? (
          <Badge variant={b.channel.type === "marketplace" ? "default" : "secondary"}>
            {b.channel.type === "marketplace" ? (
              <ShoppingBagIcon className="size-3 mr-1" />
            ) : (
              <GlobeIcon className="size-3 mr-1" />
            )}
            {b.channel.type === "marketplace" ? "Marketplace" : "Direct"}
          </Badge>
        ) : (
          <Badge variant="outline">—</Badge>
        ),
    },
    {
      header: "Price",
      cell: (b) =>
        b.channel?.type === "marketplace" && b.credits_charged != null ? (
          <div className="text-sm">
            <div>{b.credits_charged} credits</div>
            <div className="text-xs text-muted-foreground">
              {formatPrice(b.price_mad_at_booking)}
            </div>
          </div>
        ) : (
          <div className="text-sm">
            <div>{formatPrice(b.price_mad_at_booking)}</div>
            <div className="text-[10px] text-muted-foreground">at studio</div>
          </div>
        ),
    },
    {
      header: "Status",
      cell: (b) => (
        <Badge variant={STATUS_VARIANT[b.status]?.variant ?? "outline"}>
          {STATUS_VARIANT[b.status]?.label ?? b.status}
        </Badge>
      ),
    },
    {
      header: "Action",
      cell: (b) => {
        const isPendingDirect =
          b.status === "pending" && b.channel?.type !== "marketplace";
        const isConfirmedMarketplace =
          b.status === "confirmed" && b.channel?.type === "marketplace";

        if (isPendingDirect) {
          return (
            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={() => handleConfirm(b.id)}
                disabled={actionLoading === b.id}
              >
                <CheckIcon className="size-3 mr-1" /> Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDecline(b.id)}
                disabled={actionLoading === b.id}
              >
                <XIcon className="size-3" />
              </Button>
            </div>
          );
        }
        if (isConfirmedMarketplace) {
          return (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCheckin(b.id)}
              disabled={actionLoading === b.id}
            >
              <ClipboardCheckIcon className="size-3 mr-1" /> Check in
            </Button>
          );
        }
        return null;
      },
    },
  ];

  if (!entityId) {
    return <div className="p-8 text-muted-foreground">No studio access found.</div>;
  }

  const pendingCount = bookings.filter(
    (b) => b.status === "pending" && b.channel?.type !== "marketplace",
  ).length;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <p className="text-sm text-muted-foreground">
          Manage incoming reservations and check in arrivals.
        </p>
      </div>

      {/* Tab chips */}
      <div className="flex flex-wrap gap-2">
        {([
          { id: "all", label: "All" },
          { id: "pending", label: `Pending${pendingCount > 0 ? ` · ${pendingCount}` : ""}` },
          { id: "today", label: "Today" },
          { id: "marketplace", label: "Marketplace" },
          { id: "direct", label: "Direct page" },
        ] as { id: FilterTab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              tab === t.id
                ? "bg-foreground text-background border-foreground"
                : "border-input hover:bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={bookings}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        isLoading={loading}
      />
    </div>
  );
}
