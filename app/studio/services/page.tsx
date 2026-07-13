"use client";

import { useTranslations } from "next-intl";
import { BaseLayout } from "@/components/layout/base-layout";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormSheet } from "@/components/shared/form-sheet";
import {
  ServiceForm,
  EMPTY_SERVICE_FORM,
  serviceToForm,
  serviceFormToPayload,
  type ServiceFormValues,
} from "@/components/studio/service-form";
import { formatMoneyWhole } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { catalogApi, type Category } from "@/lib/api/catalog";
import { studioApi } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import {
  PackageIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface Service {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  base_price: string;
  currency: string;
  credit_price: number | null;
  duration_minutes: number;
  capacity: number;
  min_capacity: number | null;
  booking_buffer_minutes: number | null;
  cancellation_hours: number | null;
  is_active: boolean;
  is_featured: boolean;
  display_order: number | null;
  image_url: string | null;
  category_id: string | null;
}

type StatusFilter = "all" | "active" | "inactive";
type FeaturedFilter = "all" | "featured" | "regular";

export default function ServicesPage() {
  const t = useTranslations("studioMain");
  const activeEntity = useActiveEntity();
  const currency = activeEntity.currencyCode;
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ServiceFormValues>(EMPTY_SERVICE_FORM);

  // Delete state
  const [deletingService, setDeletingService] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>("all");

  const entityId = activeEntity.entityId;
  const currentRole = activeEntity.role;
  const canManage =
    currentRole === "manager" || currentRole === "owner";

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const fetchServices = () => {
    if (!entityId) return;
    studioApi
      .getServices(entityId, true)
      .then((res) => setServices(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  useEffect(() => {
    catalogApi
      .listCategories({ limit: 100 })
      .then((res) => setCategories(res.data ?? []))
      .catch(console.error);
  }, []);

  // ── Filtering ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (q) {
        const haystack = `${s.name} ${s.short_description ?? ""} ${s.description ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (categoryFilter !== "all") {
        if (categoryFilter === "uncategorized" && s.category_id) return false;
        if (categoryFilter !== "uncategorized" && s.category_id !== categoryFilter)
          return false;
      }
      if (statusFilter === "active" && !s.is_active) return false;
      if (statusFilter === "inactive" && s.is_active) return false;
      if (featuredFilter === "featured" && !s.is_featured) return false;
      if (featuredFilter === "regular" && s.is_featured) return false;
      return true;
    });
  }, [services, search, categoryFilter, statusFilter, featuredFilter]);

  const activeCount = services.filter((s) => s.is_active).length;
  const hasAnyFilter =
    !!search ||
    categoryFilter !== "all" ||
    statusFilter !== "all" ||
    featuredFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setFeaturedFilter("all");
  };

  // ── Dialog handlers ──────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingService(null);
    setForm(EMPTY_SERVICE_FORM);
    setDialogOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditingService(s);
    setForm(serviceToForm(s));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!entityId) return;
    setSaving(true);
    try {
      const payload = serviceFormToPayload(form);

      if (editingService) {
        await studioApi.updateService(entityId, editingService.id, payload);
      } else {
        await studioApi.createService(entityId, payload);
      }
      setDialogOpen(false);
      fetchServices();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (s: Service) => {
    if (!entityId || !canManage) return;
    // optimistic
    setServices((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, is_active: !s.is_active } : x)),
    );
    try {
      await studioApi.updateService(entityId, s.id, { is_active: !s.is_active });
    } catch (e) {
      console.error(e);
      fetchServices(); // refetch on failure
    }
  };

  const handleConfirmDelete = async () => {
    if (!entityId || !deletingService) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await studioApi.deleteService(entityId, deletingService.id);
      setDeletingService(null);
      fetchServices();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const subtitle = t("services.subtitle", { active: activeCount, inactive: services.length - activeCount });

  const serviceColumns: Column<Service>[] = [
    {
      header: t("services.columns.name"),
      cell: (s) => (
        <div className={!s.is_active ? "opacity-60" : ""}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate font-medium">{s.name}</span>
            {s.is_featured && (
              <StarIcon className="size-3.5 fill-amber-400 text-amber-400 shrink-0" />
            )}
          </div>
          {s.short_description && (
            <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
              {s.short_description}
            </div>
          )}
        </div>
      ),
    },
    {
      header: t("services.columns.category"),
      cell: (s) => {
        const cat = s.category_id ? categoryById.get(s.category_id) : null;
        return cat ? (
          <Badge variant="outline" className="text-[10px]">
            {cat.icon ? `${cat.icon} ` : ""}
            {cat.name}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      header: t("services.columns.duration"),
      cell: (s) => <span className="text-sm tabular-nums">{t("services.minutes", { n: s.duration_minutes })}</span>,
    },
    {
      header: t("services.columns.capacity"),
      cell: (s) => <span className="text-sm tabular-nums">{s.capacity}</span>,
    },
    {
      header: t("services.columns.price"),
      cell: (s) => (
        <span className="text-sm font-medium tabular-nums">
          {formatMoneyWhole(s.base_price, currency)}
        </span>
      ),
    },
    {
      header: t("services.columns.active"),
      cell: (s) => (
        <Switch
          checked={s.is_active}
          disabled={!canManage}
          onCheckedChange={() => handleToggleActive(s)}
        />
      ),
    },
  ];

  return (
    <BaseLayout
      maxWidth="xl"
      title={t("services.title")}
      subtitle={subtitle}
      action={
        canManage ? (
          <Button onClick={openCreate}>
            <PlusIcon className="size-4 mr-2" />
            {t("services.newService")}
          </Button>
        ) : undefined
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder={t("services.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder={t("services.filters.category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("services.filters.allCategories")}</SelectItem>
            <SelectItem value="uncategorized">{t("services.filters.uncategorized")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("services.filters.allStatuses")}</SelectItem>
            <SelectItem value="active">{t("services.filters.active")}</SelectItem>
            <SelectItem value="inactive">{t("services.filters.inactive")}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={featuredFilter}
          onValueChange={(v) => setFeaturedFilter(v as FeaturedFilter)}
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("services.filters.allServices")}</SelectItem>
            <SelectItem value="featured">{t("services.filters.featured")}</SelectItem>
            <SelectItem value="regular">{t("services.filters.notFeatured")}</SelectItem>
          </SelectContent>
        </Select>

        {hasAnyFilter && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <XIcon className="size-3.5 mr-1" /> {t("services.clear")}
          </Button>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          {t("services.showing", { shown: filtered.length, total: services.length })}
        </div>
      </div>

      {/* Table */}
      {!loading && filtered.length === 0 ? (
        <div className="rounded-lg border border-border py-12">
          <EmptyState
            hasServices={services.length > 0}
            canManage={!!canManage}
            onCreate={openCreate}
            onClear={clearFilters}
          />
        </div>
      ) : (
        <DataTable
          columns={serviceColumns}
          data={filtered}
          isLoading={loading}
          rowActions={
            canManage
              ? (s) => [
                  {
                    label: "Edit",
                    icon: PencilIcon,
                    onClick: () => openEdit(s),
                  },
                  {
                    label: "Delete",
                    icon: Trash2Icon,
                    variant: "destructive",
                    separatorBefore: true,
                    onClick: () => {
                      setDeletingService(s);
                      setDeleteError(null);
                    },
                  },
                ]
              : undefined
          }
        />
      )}

      {/* Create / Edit sheet */}
      <FormSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingService ? t("services.form.editTitle") : t("services.form.newTitle")}
        subtitle={t("services.form.subtitle")}
        icon={PackageIcon}
        iconAccent="violet"
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              {t("services.form.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !form.name ||
                !form.duration_minutes ||
                !form.capacity ||
                !form.base_price
              }
            >
              {saving
                ? t("services.form.saving")
                : editingService
                  ? t("services.form.updateService")
                  : t("services.form.createService")}
            </Button>
          </>
        }
      >
        <ServiceForm
          form={form}
          setForm={setForm}
          categories={categories}
          currency={currency}
        />
      </FormSheet>

      {/* Delete confirmation sheet */}
      <FormSheet
        open={!!deletingService}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingService(null);
            setDeleteError(null);
          }
        }}
        title={t("services.delete.title")}
        subtitle={t("services.delete.subtitle")}
        icon={Trash2Icon}
        iconAccent="destructive"
        width="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setDeletingService(null);
                setDeleteError(null);
              }}
              disabled={deleting}
            >
              {t("services.form.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? t("services.delete.deleting") : t("services.delete.confirm")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm">
            {t.rich("services.delete.prompt", {
              name: deletingService?.name ?? "",
              strong: (chunks) => <span className="font-semibold">{chunks}</span>,
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("services.delete.hint")}
          </p>
          {deleteError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {deleteError}
            </div>
          )}
        </div>
      </FormSheet>
    </BaseLayout>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({
  hasServices,
  canManage,
  onCreate,
  onClear,
}: {
  hasServices: boolean;
  canManage: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  const t = useTranslations("studioMain");
  if (!hasServices) {
    return (
      <div className="text-center">
        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <PackageIcon className="size-5 text-primary" />
        </div>
        <h3 className="font-semibold text-sm">{t("services.empty.noServicesTitle")}</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          {t("services.empty.noServicesDesc")}
        </p>
        {canManage && (
          <Button size="sm" className="mt-3" onClick={onCreate}>
            <PlusIcon className="size-3.5 mr-1.5" />
            {t("services.empty.createService")}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="text-center text-sm text-muted-foreground">
      {t("services.empty.noMatch")}
      <Button variant="link" size="sm" onClick={onClear} className="ml-2">
        {t("services.empty.clearFilters")}
      </Button>
    </div>
  );
}
