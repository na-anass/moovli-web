"use client";

import { useTranslations } from "next-intl";
import { BaseLayout } from "@/components/layout/base-layout";
import { formatMoneyWhole } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import { DataTable, type Column, type RowAction } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { studioApi, type StudioBookingRow } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
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
  { variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pending: { variant: "secondary" },
  confirmed: { variant: "default" },
  checked_in: { variant: "default" },
  completed: { variant: "outline" },
  cancelled: { variant: "outline" },
  no_show: { variant: "destructive" },
};


export default function StudioBookingsPage() {
  const t = useTranslations("studioMain");
  const activeEntity = useActiveEntity();
  const entityId = activeEntity.entityId;
  const currency = activeEntity.currencyCode;
  const formatPrice = (n: number | null) => (n != null ? formatMoneyWhole(n, currency) : "—");

  const [tab, setTab] = useState<FilterTab>("all");
  const [bookings, setBookings] = useState<StudioBookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [scanCode, setScanCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const pageSize = 25;

  // Debounce the search box so we don't refetch on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

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
      if (search) params.search = search;

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
  }, [entityId, page, tab, search]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    setPage(1);
  }, [tab, search]);

  const handleConfirm = async (bookingId: string) => {
    if (!entityId) return;
    setActionLoading(bookingId);
    try {
      await studioApi.confirmBooking(entityId, bookingId);
      await fetchBookings();
    } catch (e) {
      alert((e as Error).message || t("bookings.errors.confirmFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (bookingId: string) => {
    if (!entityId) return;
    const reason = prompt(t("bookings.declinePrompt")) ?? undefined;
    if (reason === null) return;
    setActionLoading(bookingId);
    try {
      await studioApi.declineBooking(entityId, bookingId, reason);
      await fetchBookings();
    } catch (e) {
      alert((e as Error).message || t("bookings.errors.declineFailed"));
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
      alert((e as Error).message || t("bookings.errors.checkinFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleScan = async () => {
    if (!entityId || !scanCode.trim()) return;
    setScanning(true);
    setScanMsg(null);
    try {
      await studioApi.scanBooking(entityId, scanCode.trim());
      setScanMsg({ ok: true, text: t("bookings.scan.success", { code: scanCode.trim() }) });
      setScanCode("");
      await fetchBookings();
    } catch (e) {
      const msg = (e as Error).message;
      const known = t.has(`bookings.scan.errors.${msg}`)
        ? t(`bookings.scan.errors.${msg}`)
        : t("bookings.scan.errors.generic");
      setScanMsg({ ok: false, text: known });
    } finally {
      setScanning(false);
    }
  };

  const columns: Column<StudioBookingRow>[] = [
    {
      header: t("bookings.columns.customer"),
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
      header: t("bookings.columns.session"),
      cell: (b) => (
        <div className="text-sm">
          <div>{b.service?.name ?? t("bookings.sessionFallback")}</div>
          <div className="text-xs text-muted-foreground">
            {formatDateTime(b.session?.start_time ?? null)}
          </div>
        </div>
      ),
    },
    {
      header: t("bookings.columns.channel"),
      cell: (b) =>
        b.channel ? (
          <Badge variant={b.channel.type === "marketplace" ? "default" : "secondary"}>
            {b.channel.type === "marketplace" ? (
              <ShoppingBagIcon className="size-3 mr-1" />
            ) : (
              <GlobeIcon className="size-3 mr-1" />
            )}
            {b.channel.type === "marketplace" ? t("bookings.marketplace") : t("bookings.direct")}
          </Badge>
        ) : (
          <Badge variant="outline">—</Badge>
        ),
    },
    {
      header: t("bookings.columns.price"),
      cell: (b) => (
        <div className="text-sm">
          <div>{formatPrice(b.price_mad_at_booking)}</div>
          {b.channel?.type !== "marketplace" && (
            <div className="text-[10px] text-muted-foreground">{t("bookings.atStudio")}</div>
          )}
        </div>
      ),
    },
    {
      header: t("bookings.columns.status"),
      cell: (b) => (
        <Badge variant={STATUS_VARIANT[b.status]?.variant ?? "outline"}>
          {t.has(`bookings.status.${b.status}`) ? t(`bookings.status.${b.status}`) : b.status}
        </Badge>
      ),
    },
  ];

  const rowActions = (b: StudioBookingRow): RowAction[] => {
    const isPendingDirect =
      b.status === "pending" && b.channel?.type !== "marketplace";
    // Any confirmed booking can be checked in — the studio check-in endpoint is
    // channel-agnostic and windowless. Direct bookings need this too, otherwise
    // they never leave `confirmed` and bookingStatus.job marks them `no_show`.
    const isConfirmed = b.status === "confirmed";
    const busy = actionLoading === b.id;

    if (isPendingDirect) {
      return [
        {
          label: t("bookings.actions.confirm"),
          icon: CheckIcon,
          disabled: busy,
          onClick: () => handleConfirm(b.id),
        },
        {
          label: t("bookings.actions.decline"),
          icon: XIcon,
          variant: "destructive",
          disabled: busy,
          onClick: () => handleDecline(b.id),
        },
      ];
    }
    if (isConfirmed) {
      return [
        {
          label: t("bookings.actions.checkin"),
          icon: ClipboardCheckIcon,
          disabled: busy,
          onClick: () => handleCheckin(b.id),
        },
      ];
    }
    return [];
  };

  if (!entityId) {
    return <div className="p-8 text-muted-foreground">{t("bookings.noAccess")}</div>;
  }

  const pendingCount = bookings.filter(
    (b) => b.status === "pending" && b.channel?.type !== "marketplace",
  ).length;

  return (
    <BaseLayout
      maxWidth="xl"
      title={t("bookings.title")}
      subtitle={t("bookings.subtitle")}
    >
      {/* Desk check-in: scan or type a guest's BK- code */}
      <div className="rounded-lg border bg-card p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleScan();
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <ClipboardCheckIcon className="size-4 text-muted-foreground" />
          <input
            value={scanCode}
            onChange={(e) => {
              setScanCode(e.target.value);
              setScanMsg(null);
            }}
            placeholder={t("bookings.scan.placeholder")}
            className="flex-1 min-w-45 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={scanning || !scanCode.trim()}
            className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
          >
            {scanning ? t("bookings.scan.checking") : t("bookings.scan.action")}
          </button>
        </form>
        {scanMsg && (
          <p className={`mt-2 text-xs ${scanMsg.ok ? "text-emerald-600" : "text-destructive"}`}>
            {scanMsg.text}
          </p>
        )}
      </div>

      {/* Tab chips */}
      <div className="flex flex-wrap gap-2">
        {([
          { id: "all", label: t("bookings.tabs.all") },
          { id: "pending", label: `${t("bookings.tabs.pending")}${pendingCount > 0 ? ` · ${pendingCount}` : ""}` },
          { id: "today", label: t("bookings.tabs.today") },
          { id: "marketplace", label: t("bookings.tabs.marketplace") },
          { id: "direct", label: t("bookings.tabs.direct") },
        ] as { id: FilterTab; label: string }[]).map((tab_) => (
          <button
            key={tab_.id}
            onClick={() => setTab(tab_.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              tab === tab_.id
                ? "bg-foreground text-background border-foreground"
                : "border-input hover:bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab_.label}
          </button>
        ))}
      </div>

      {/* Search by reference / guest name / email */}
      <input
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder={t("bookings.searchPlaceholder")}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      <DataTable
        columns={columns}
        data={bookings}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        rowActions={rowActions}
        isLoading={loading}
      />
    </BaseLayout>
  );
}
