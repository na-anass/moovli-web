"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/shared/data-table";
import { InfoTip } from "@/components/ui/info-tip";
import { adminApi } from "@/lib/api/admin";
import { Badge } from "@/components/ui/badge";
import { EyeIcon, ExternalLinkIcon } from "lucide-react";

interface Entity {
  id: string;
  name: string;
  city: string;
  status: string;
  is_partner: boolean;
  partnership_tier: string;
  total_reviews: number;
  created_at: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  pending_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function StudiosPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const router = useRouter();
  const [data, setData] = useState<Entity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getEntities({
        page,
        limit: 20,
        search: search || undefined,
        status: status === "all" ? undefined : status,
      });
      setData(res.data);
      setTotal(res.pagination.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const columns: Column<Entity>[] = [
    { header: tc("name"), accessorKey: "name" },
    { header: t("studios.city"), accessorKey: "city" },
    {
      header: tc("status"),
      cell: (row) => (
        <Badge variant="outline" className={statusColors[row.status] || ""}>
          {row.status}
        </Badge>
      ),
    },
    {
      header: t("studios.partner"),
      cell: (row) =>
        row.is_partner ? (
          <Badge className="bg-primary/10 text-primary">{row.partnership_tier}</Badge>
        ) : (
          <span className="text-muted-foreground text-sm">{tc("no")}</span>
        ),
    },
    {
      header: t("studios.reviews"),
      cell: (row) => <span>{row.total_reviews}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold">{t("studios.title")}</h1>
          <InfoTip term="studio" />
        </div>
        <p className="text-sm text-muted-foreground">{t("studios.totalCount", { count: total })}</p>
      </div>

      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder={t("studios.searchPlaceholder")}
        filters={[
          {
            label: tc("status"),
            value: status,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
            options: [
              { label: t("studios.allStatuses"), value: "all" },
              { label: t("studios.statusActive"), value: "active" },
              { label: t("studios.statusDraft"), value: "draft" },
              { label: t("studios.statusPendingReview"), value: "pending_review" },
              { label: t("studios.statusSuspended"), value: "suspended" },
              { label: t("studios.statusInactive"), value: "inactive" },
            ],
          },
        ]}
        isLoading={loading}
        rowActions={(row) => [
          {
            label: t("studios.viewStudio"),
            icon: EyeIcon,
            onClick: () => router.push(`/admin/studios/${row.id}`),
          },
          {
            label: t("studios.openDashboard"),
            icon: ExternalLinkIcon,
            onClick: () => router.push(`/studio/dashboard?as=${row.id}`),
          },
        ]}
      />
    </div>
  );
}
