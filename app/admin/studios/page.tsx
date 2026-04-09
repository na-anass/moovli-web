"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/shared/data-table";
import { adminApi } from "@/lib/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const router = useRouter();
  const [data, setData] = useState<Entity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getEntities({ page, limit: 20, search: search || undefined });
      setData(res.data);
      setTotal(res.pagination.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const columns: Column<Entity>[] = [
    { header: "Name", accessorKey: "name" },
    { header: "City", accessorKey: "city" },
    {
      header: "Status",
      cell: (row) => (
        <Badge variant="outline" className={statusColors[row.status] || ""}>
          {row.status}
        </Badge>
      ),
    },
    {
      header: "Partner",
      cell: (row) =>
        row.is_partner ? (
          <Badge className="bg-primary/10 text-primary">{row.partnership_tier}</Badge>
        ) : (
          <span className="text-muted-foreground text-sm">No</span>
        ),
    },
    {
      header: "Reviews",
      cell: (row) => <span>{row.total_reviews}</span>,
    },
    {
      header: "",
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/admin/studios/${row.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Studios</h1>
        <p className="text-sm text-muted-foreground">{total} total</p>
      </div>

      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search by name or city..."
        isLoading={loading}
      />
    </div>
  );
}
