"use client";

import { BaseLayout } from "@/components/layout/base-layout";
import { formatMoneyWhole } from "@/lib/money";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { studioApi, type AcquisitionSource, type EntityCustomer } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const SOURCE_LABEL: Record<AcquisitionSource, { label: string; variant: "default" | "secondary" | "outline" }> = {
  marketplace: { label: "Marketplace", variant: "default" },
  direct_hosted: { label: "Booking page", variant: "secondary" },
  direct_link: { label: "Custom link", variant: "secondary" },
  direct_embed: { label: "Widget", variant: "secondary" },
  manual: { label: "Manual", variant: "outline" },
  unknown: { label: "—", variant: "outline" },
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export default function StudioCustomersPage() {
  const { roles } = useAuth();
  const currency = roles?.ownedEntities?.[0]?.currencyCode ?? "MAD";
  const entityId = roles?.ownedEntities?.[0]?.entityId;

  const [customers, setCustomers] = useState<EntityCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<AcquisitionSource | "">("");
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  const fetchCustomers = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await studioApi.listCustomers(entityId, {
        search: search || undefined,
        acquisitionSource: sourceFilter || undefined,
        sortBy: "last_booking_at",
        sortOrder: "desc",
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setCustomers(res.data);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId, page, search, sourceFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const columns: Column<EntityCustomer>[] = [
    {
      header: "Name",
      cell: (c) => (
        <Link href={`/studio/customers/${c.id}`} className="font-medium hover:underline">
          {c.name}
        </Link>
      ),
    },
    {
      header: "Contact",
      cell: (c) => (
        <div className="text-sm">
          <div>{c.email}</div>
          {c.phone && <div className="text-muted-foreground text-xs">{c.phone}</div>}
        </div>
      ),
    },
    {
      header: "Source",
      cell: (c) => (
        <Badge variant={SOURCE_LABEL[c.acquisition_source].variant}>
          {SOURCE_LABEL[c.acquisition_source].label}
        </Badge>
      ),
    },
    {
      header: "Bookings",
      cell: (c) => (
        <div className="text-sm">
          <div className="font-medium">{c.completed_bookings + c.confirmed_bookings}</div>
          <div className="text-muted-foreground text-xs">{c.total_bookings} total</div>
        </div>
      ),
    },
    {
      header: "Lifetime value",
      cell: (c) => <span className="font-medium">{formatMoneyWhole(c.lifetime_value_mad, currency)}</span>,
    },
    {
      header: "Last booking",
      cell: (c) => <span className="text-sm">{formatDate(c.last_booking_at)}</span>,
    },
    {
      header: "Status",
      cell: (c) => (
        <div className="text-xs text-muted-foreground">
          {c.user_id ? <Badge variant="outline">Account</Badge> : <Badge variant="outline">Guest</Badge>}
        </div>
      ),
    },
  ];

  if (!entityId) {
    return <div className="p-8 text-muted-foreground">No studio access found.</div>;
  }

  return (
    <BaseLayout
      maxWidth="xl"
      title="Customers"
      subtitle={`Everyone who has booked a session with you. ${total} total.`}
    >
      {/* Source filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSourceFilter("")}
          className={`px-3 py-1 rounded-full text-xs border ${sourceFilter === "" ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"}`}
        >
          All
        </button>
        {(Object.keys(SOURCE_LABEL) as AcquisitionSource[])
          .filter((s) => s !== "unknown" && s !== "manual")
          .map((src) => (
            <button
              key={src}
              onClick={() => setSourceFilter(sourceFilter === src ? "" : src)}
              className={`px-3 py-1 rounded-full text-xs border ${sourceFilter === src ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"}`}
            >
              {SOURCE_LABEL[src].label}
            </button>
          ))}
      </div>

      <DataTable
        columns={columns}
        data={customers}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        searchPlaceholder="Search by name or email..."
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        isLoading={loading}
      />
    </BaseLayout>
  );
}
