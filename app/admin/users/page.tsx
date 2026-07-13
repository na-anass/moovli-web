"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDate } from "@/lib/datetime";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/shared/data-table";
import { InfoTip } from "@/components/ui/info-tip";
import { adminApi } from "@/lib/api/admin";
import { Badge } from "@/components/ui/badge";
import { EyeIcon } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  status: string;
  credit_balance: number;
  created_at: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  pending_verification: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

export default function UsersPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const router = useRouter();
  const [data, setData] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers({
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
    fetchUsers();
  }, [fetchUsers]);

  const columns: Column<User>[] = [
    { header: tc("name"), accessorKey: "name" },
    { header: tc("email"), accessorKey: "email" },
    {
      header: tc("status"),
      cell: (row) => (
        <Badge variant="outline" className={statusColors[row.status] || ""}>
          {row.status}
        </Badge>
      ),
    },
    {
      header: t("users.credits"),
      cell: (row) => <span className="font-medium">{row.credit_balance}</span>,
    },
    {
      header: t("users.joined"),
      cell: (row) => formatDate(row.created_at),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("users.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("users.totalCount", { count: total })}</p>
      </div>

      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder={t("users.searchPlaceholder")}
        filters={[
          {
            label: tc("status"),
            value: status,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
            options: [
              { label: t("users.allStatuses"), value: "all" },
              { label: t("users.statusActive"), value: "active" },
              { label: t("users.statusSuspended"), value: "suspended" },
              { label: t("users.statusPendingVerification"), value: "pending_verification" },
            ],
          },
        ]}
        isLoading={loading}
        rowActions={(row) => [
          {
            label: t("users.viewProfile"),
            icon: EyeIcon,
            onClick: () => router.push(`/admin/users/${row.id}`),
          },
        ]}
      />
    </div>
  );
}
