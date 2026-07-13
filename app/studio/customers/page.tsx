"use client";

import { useTranslations } from "next-intl";
import { BaseLayout } from "@/components/layout/base-layout";
import { formatMoneyWhole } from "@/lib/money";
import { formatDate } from "@/lib/datetime";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { studioApi, type AcquisitionSource, type EntityCustomer } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const SOURCE_LABEL: Record<AcquisitionSource, { labelKey: string; variant: "default" | "secondary" | "outline" }> = {
  marketplace: { labelKey: "marketplace", variant: "default" },
  direct_hosted: { labelKey: "direct", variant: "secondary" },
  // direct_link + direct_embed exist in the schema but their UI is hidden until
  // we ship custom-link / embeddable-widget channels. Bookings on those types
  // still get labeled — they just fall through to "Direct" via the dropdown
  // collapse in HIDDEN_SOURCES below.
  direct_link: { labelKey: "direct", variant: "secondary" },
  direct_embed: { labelKey: "direct", variant: "secondary" },
  manual: { labelKey: "manual", variant: "outline" },
  unknown: { labelKey: "unknown", variant: "outline" },
};

// Filter chips only surface these — keeps the customer-source filter focused
// on the two channels studios actually configure today.
const VISIBLE_FILTER_SOURCES: AcquisitionSource[] = ["marketplace", "direct_hosted"];


export default function StudioCustomersPage() {
  const t = useTranslations("studioMain");
  const activeEntity = useActiveEntity();
  const router = useRouter();
  const currency = activeEntity.currencyCode;
  const entityId = activeEntity.entityId;

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
      header: t("customers.columns.name"),
      cell: (c) => (
        <Link href={`/studio/customers/${c.id}`} className="font-medium hover:underline">
          {c.name}
        </Link>
      ),
    },
    {
      header: t("customers.columns.contact"),
      cell: (c) => (
        <div className="text-sm">
          <div>{c.email}</div>
          {c.phone && <div className="text-muted-foreground text-xs">{c.phone}</div>}
        </div>
      ),
    },
    {
      header: t("customers.columns.source"),
      cell: (c) => (
        <Badge variant={SOURCE_LABEL[c.acquisition_source].variant}>
          {t(`customers.source.${SOURCE_LABEL[c.acquisition_source].labelKey}`)}
        </Badge>
      ),
    },
    {
      header: t("customers.columns.bookings"),
      cell: (c) => (
        <div className="text-sm">
          <div className="font-medium">{c.completed_bookings + c.confirmed_bookings}</div>
          <div className="text-muted-foreground text-xs">{t("customers.totalCount", { count: c.total_bookings })}</div>
        </div>
      ),
    },
    {
      header: t("customers.columns.lifetimeValue"),
      cell: (c) => <span className="font-medium">{formatMoneyWhole(c.lifetime_value_mad, currency)}</span>,
    },
    {
      header: t("customers.columns.lastBooking"),
      cell: (c) => <span className="text-sm">{formatDate(c.last_booking_at)}</span>,
    },
    {
      header: t("customers.columns.status"),
      cell: (c) => (
        <div className="text-xs text-muted-foreground">
          {c.user_id ? <Badge variant="outline">{t("customers.account")}</Badge> : <Badge variant="outline">{t("customers.guest")}</Badge>}
        </div>
      ),
    },
  ];

  if (!entityId) {
    return <div className="p-8 text-muted-foreground">{t("customers.noAccess")}</div>;
  }

  return (
    <BaseLayout
      maxWidth="xl"
      title={t("customers.title")}
      subtitle={t("customers.subtitle", { total })}
    >
      <DataTable
        columns={columns}
        data={customers}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        searchPlaceholder={t("customers.searchPlaceholder")}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        filters={[
          {
            label: t("customers.columns.source"),
            value: sourceFilter || "all",
            onChange: (v) => {
              setSourceFilter(v === "all" ? "" : (v as AcquisitionSource));
              setPage(1);
            },
            options: [
              { label: t("customers.allSources"), value: "all" },
              ...VISIBLE_FILTER_SOURCES.map((src) => ({
                label: t(`customers.source.${SOURCE_LABEL[src].labelKey}`),
                value: src,
              })),
            ],
          },
        ]}
        rowActions={(c) => [
          {
            label: t("customers.viewCustomer"),
            icon: EyeIcon,
            onClick: () => router.push(`/studio/customers/${c.id}`),
          },
        ]}
        isLoading={loading}
      />
    </BaseLayout>
  );
}
