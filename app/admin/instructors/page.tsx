"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/shared/data-table";
import { InfoTip } from "@/components/ui/info-tip";
import { adminApi } from "@/lib/api/admin";
import { Badge } from "@/components/ui/badge";

interface Instructor {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  specializations: string[] | null;
  experience_years: number | null;
  rating: number | null;
  total_reviews: number;
  total_sessions: number;
  tier: string | null;
  is_active: boolean;
  account_state: "linked" | "external";
  entity?: { id: string; name: string; city: string | null } | null;
}

const TIER_COLORS: Record<string, string> = {
  standard: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  premium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  elite: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export default function AdminInstructorsPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [data, setData] = useState<Instructor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchInstructors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getInstructors({
        page,
        limit: 20,
        search: search || undefined,
        is_active: active === "all" ? undefined : active === "active",
      });
      setData(res.data);
      setTotal(res.pagination.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, active]);

  useEffect(() => {
    fetchInstructors();
  }, [fetchInstructors]);

  const columns: Column<Instructor>[] = [
    {
      header: t("instructors.instructor"),
      cell: (r) => (
        <div className="flex items-center gap-3">
          {r.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.avatar_url} alt="" className="size-8 rounded-full object-cover" />
          ) : (
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
              {r.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium">{r.name}</p>
            {r.title && <p className="text-xs text-muted-foreground">{r.title}</p>}
          </div>
        </div>
      ),
    },
    {
      header: t("instructors.studio"),
      cell: (r) => (
        <div className="text-sm">
          <div>{r.entity?.name ?? "—"}</div>
          {r.entity?.city && <div className="text-xs text-muted-foreground">{r.entity.city}</div>}
        </div>
      ),
    },
    {
      header: t("instructors.skills"),
      cell: (r) =>
        r.specializations && r.specializations.length > 0 ? (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {r.specializations.slice(0, 3).map((s) => (
              <Badge key={s} variant="outline" className="text-[10px]">
                {s}
              </Badge>
            ))}
            {r.specializations.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{r.specializations.length - 3}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      header: t("instructors.tier"),
      cell: (r) => (
        <Badge variant="outline" className={TIER_COLORS[r.tier ?? "standard"] || ""}>
          {r.tier ?? "standard"}
        </Badge>
      ),
    },
    {
      header: t("instructors.rating"),
      cell: (r) => (
        <span className="text-sm">
          {r.rating != null ? `${Number(r.rating).toFixed(1)} (${r.total_reviews})` : "—"}
        </span>
      ),
    },
    {
      header: t("instructors.account"),
      cell: (r) =>
        r.account_state === "linked" ? (
          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {t("instructors.accountLinked")}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">{t("instructors.accountExternal")}</Badge>
        ),
    },
    {
      header: tc("status"),
      cell: (r) => (
        <Badge variant="outline" className={r.is_active ? "" : "text-muted-foreground"}>
          {r.is_active ? t("instructors.active") : t("instructors.inactive")}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold">{t("instructors.title")}</h1>
          <InfoTip term="instructor" />
        </div>
        <p className="text-sm text-muted-foreground">{t("instructors.totalCount", { count: total })}</p>
      </div>

      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        searchPlaceholder={t("instructors.searchPlaceholder")}
        filters={[
          {
            label: tc("status"),
            value: active,
            onChange: (v) => {
              setActive(v);
              setPage(1);
            },
            options: [
              { label: tc("all"), value: "all" },
              { label: t("instructors.active"), value: "active" },
              { label: t("instructors.inactive"), value: "inactive" },
            ],
          },
        ]}
        isLoading={loading}
      />
    </div>
  );
}
