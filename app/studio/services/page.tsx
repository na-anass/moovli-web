"use client";

import { BaseLayout } from "@/components/layout/base-layout";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormSheet } from "@/components/shared/form-sheet";
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
  ClockIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
  UsersIcon,
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

const EMPTY_FORM = {
  name: "",
  description: "",
  short_description: "",
  base_price: "",
  duration_minutes: "60",
  capacity: "10",
  min_capacity: "",
  booking_buffer_minutes: "15",
  cancellation_hours: "24",
  is_featured: false,
  category_id: "",
};

type StatusFilter = "all" | "active" | "inactive";
type FeaturedFilter = "all" | "featured" | "regular";

export default function ServicesPage() {
  const activeEntity = useActiveEntity();
  const currency = activeEntity.currencyCode;
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

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
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditingService(s);
    setForm({
      name: s.name,
      description: s.description || "",
      short_description: s.short_description || "",
      base_price: String(s.base_price),
      duration_minutes: String(s.duration_minutes),
      capacity: String(s.capacity),
      min_capacity: String(s.min_capacity || ""),
      booking_buffer_minutes: String(s.booking_buffer_minutes ?? 15),
      cancellation_hours: String(s.cancellation_hours ?? 24),
      is_featured: s.is_featured,
      category_id: s.category_id || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!entityId) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        short_description: form.short_description || null,
        base_price: parseFloat(form.base_price) || 0,
        duration_minutes: parseInt(form.duration_minutes) || 60,
        capacity: parseInt(form.capacity) || 10,
        min_capacity: parseInt(form.min_capacity) || null,
        booking_buffer_minutes: parseInt(form.booking_buffer_minutes) || 15,
        cancellation_hours: parseInt(form.cancellation_hours) || 24,
        is_featured: form.is_featured,
        category_id: form.category_id || null,
      };

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
  const subtitle = `${activeCount} active · ${services.length - activeCount} inactive`;

  const serviceColumns: Column<Service>[] = [
    {
      header: "Name",
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
      header: "Category",
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
      header: "Duration",
      cell: (s) => <span className="text-sm tabular-nums">{s.duration_minutes} min</span>,
    },
    {
      header: "Capacity",
      cell: (s) => <span className="text-sm tabular-nums">{s.capacity}</span>,
    },
    {
      header: "Price",
      cell: (s) => (
        <span className="text-sm font-medium tabular-nums">
          {formatMoneyWhole(s.base_price, currency)}
        </span>
      ),
    },
    {
      header: "Active",
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
      title="Services"
      subtitle={subtitle}
      action={
        canManage ? (
          <Button onClick={openCreate}>
            <PlusIcon className="size-4 mr-2" />
            New service
          </Button>
        ) : undefined
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search services…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="uncategorized">Uncategorized</SelectItem>
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
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
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
            <SelectItem value="all">All services</SelectItem>
            <SelectItem value="featured">Featured</SelectItem>
            <SelectItem value="regular">Not featured</SelectItem>
          </SelectContent>
        </Select>

        {hasAnyFilter && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <XIcon className="size-3.5 mr-1" /> Clear
          </Button>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          Showing {filtered.length} of {services.length}
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
        title={editingService ? "Edit service" : "New service"}
        subtitle="What people book — a class, a session, a treatment."
        icon={PackageIcon}
        iconAccent="violet"
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
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
                ? "Saving…"
                : editingService
                  ? "Update service"
                  : "Create service"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input
                className="mt-1.5"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Megaformer Pilates"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Category</label>
              <Select
                value={form.category_id || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, category_id: v === "none" ? "" : v })
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Pick a category…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ""}
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Helps consumers discover your service by type (yoga, HIIT, spa…).
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Short description</label>
              <Input
                className="mt-1.5"
                value={form.short_description}
                onChange={(e) =>
                  setForm({ ...form, short_description: e.target.value })
                }
                placeholder="One-line summary"
                maxLength={500}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="mt-1.5 w-full rounded-lg border border-border bg-background p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detailed description…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <ClockIcon className="size-3" /> Duration (min) *
                </label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={form.duration_minutes}
                  min="5"
                  onChange={(e) =>
                    setForm({ ...form, duration_minutes: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <UsersIcon className="size-3" /> Capacity *
                </label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={form.capacity}
                  min="1"
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Price ({currency}) *</label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={form.base_price}
                  min="0"
                  step="0.01"
                  onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Min capacity</label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={form.min_capacity}
                  min="0"
                  onChange={(e) => setForm({ ...form, min_capacity: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Booking buffer (min)</label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={form.booking_buffer_minutes}
                  min="0"
                  onChange={(e) =>
                    setForm({ ...form, booking_buffer_minutes: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Cancellation window (hours)</label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={form.cancellation_hours}
                  min="0"
                  onChange={(e) =>
                    setForm({ ...form, cancellation_hours: e.target.value })
                  }
                />
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_featured}
                    onCheckedChange={(v) => setForm({ ...form, is_featured: v })}
                  />
                  <label className="text-sm font-medium flex items-center gap-1">
                    <StarIcon className="size-3" /> Featured
                  </label>
                </div>
              </div>
            </div>

        </div>
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
        title="Delete service?"
        subtitle="This action cannot be undone."
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
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete service"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm">
            Permanently delete{" "}
            <span className="font-semibold">{deletingService?.name}</span>?
          </p>
          <p className="text-xs text-muted-foreground">
            If the service has any sessions, the delete will be blocked — deactivate
            it instead, which hides it from new schedules without breaking existing
            bookings.
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
  if (!hasServices) {
    return (
      <div className="text-center">
        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <PackageIcon className="size-5 text-primary" />
        </div>
        <h3 className="font-semibold text-sm">No services yet</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Create your first service to start scheduling sessions.
        </p>
        {canManage && (
          <Button size="sm" className="mt-3" onClick={onCreate}>
            <PlusIcon className="size-3.5 mr-1.5" />
            Create service
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="text-center text-sm text-muted-foreground">
      No services match your filters.
      <Button variant="link" size="sm" onClick={onClear} className="ml-2">
        Clear filters
      </Button>
    </div>
  );
}
