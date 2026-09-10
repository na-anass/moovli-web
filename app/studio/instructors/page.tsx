"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BaseLayout } from "@/components/layout/base-layout";
import { DataTable, type Column, type RowAction } from "@/components/shared/data-table";
import { FormSheet } from "@/components/shared/form-sheet";
import {
  ProviderForm,
  EMPTY_PROVIDER_FORM,
  providerToForm,
  providerFormToPayload,
  type ProviderFormValues,
} from "@/components/studio/provider-form";
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
import { studioApi } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import { formatMoneyWhole } from "@/lib/money";
import {
  EyeIcon,
  MailIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";

interface Provider {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  bio?: string | null;
  short_bio?: string | null;
  tier?: string | null;
  rating?: number | null;
  total_reviews?: number | null;
  total_sessions?: number | null;
  avatar_url?: string | null;
  specializations?: string[] | null;
  experience_years?: number | null;
  base_rate?: number | null;
  is_active: boolean;
  is_featured?: boolean | null;
  display_order?: number | null;
  social_links?: Record<string, string> | null;
}

const tierColors: Record<string, string> = {
  standard: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
  premium: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  elite: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const PAGE_SIZE = 20;

export default function InstructorsPage() {
  const t = useTranslations("studioMain.instructorsPage");
  const activeEntity = useActiveEntity();
  const entityId = activeEntity.entityId;
  const currency = activeEntity.currencyCode;
  const canManage = activeEntity.role === "manager" || activeEntity.role === "owner";

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters / search / sort / pagination (client-side over the full list).
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortKey, setSortKey] = useState<"name" | "tier" | "total_sessions" | "rating">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  // Create / edit form.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState<ProviderFormValues>(EMPTY_PROVIDER_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete confirmation.
  const [deleting, setDeleting] = useState<Provider | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Read-only profile preview.
  const [preview, setPreview] = useState<Provider | null>(null);

  const fetchProviders = useCallback(() => {
    if (!entityId) return;
    setLoading(true);
    studioApi
      .getProviders(entityId, true)
      .then((res) => setProviders(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityId]);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  // ── filter → sort → paginate ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return providers.filter((p) => {
      if (q) {
        const hay = `${p.name} ${p.email ?? ""} ${p.title ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter === "active" && !p.is_active) return false;
      if (statusFilter === "inactive" && p.is_active) return false;
      return true;
    });
  }, [providers, search, statusFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (p: Provider): string | number => {
      switch (sortKey) {
        case "tier": return p.tier ?? "standard";
        case "total_sessions": return p.total_sessions ?? 0;
        case "rating": return p.rating ?? 0;
        default: return p.name.toLowerCase();
      }
    };
    return [...filtered].sort((a, b) => {
      const av = val(a), bv = val(b);
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [filtered, sortKey, sortDir]);

  const paged = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sorted, page],
  );

  const handleSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key as typeof sortKey); setSortDir("asc"); }
    setPage(1);
  };

  // ── create / edit ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_PROVIDER_FORM);
    setSaveError(null);
    setDialogOpen(true);
  };

  const openEdit = (p: Provider) => {
    setEditing(p);
    setForm(providerToForm(p));
    setSaveError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!entityId || !form.name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = providerFormToPayload(form);
      if (editing) await studioApi.updateProvider(entityId, editing.id, payload);
      else await studioApi.createProvider(entityId, payload);
      setDialogOpen(false);
      fetchProviders();
    } catch (e) {
      console.error(e);
      setSaveError((e as Error).message || t("form.saveError"));
    } finally {
      setSaving(false);
    }
  };

  // Inline active toggle (optimistic, like the services table).
  const handleToggleActive = async (p: Provider) => {
    if (!entityId) return;
    setProviders((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)));
    try {
      await studioApi.updateProvider(entityId, p.id, { is_active: !p.is_active });
    } catch (e) {
      console.error(e);
      fetchProviders();
    }
  };

  const handleConfirmDelete = async () => {
    if (!entityId || !deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await studioApi.deleteProvider(entityId, deleting.id);
      setDeleting(null);
      fetchProviders();
    } catch (e) {
      console.error(e);
      setDeleteError((e as Error).message || t("del.error"));
    } finally {
      setDeleteBusy(false);
    }
  };

  // ── columns ────────────────────────────────────────────────────────────────
  const columns: Column<Provider>[] = [
    {
      header: t("col.instructor"),
      sortKey: "name",
      cell: (p) => (
        <div className={`flex items-center gap-3 ${!p.is_active ? "opacity-60" : ""}`}>
          {p.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatar_url} alt={p.name} className="size-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="flex items-center justify-center size-9 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
              {getInitials(p.name)}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium truncate">{p.name}</span>
              {p.is_featured && <StarIcon className="size-3.5 fill-amber-400 text-amber-400 shrink-0" />}
            </div>
            {p.title && <p className="text-xs text-muted-foreground truncate">{p.title}</p>}
          </div>
        </div>
      ),
    },
    {
      header: t("col.contact"),
      cell: (p) => (
        <div className="text-xs text-muted-foreground space-y-0.5">
          {p.email && <p className="flex items-center gap-1 truncate"><MailIcon className="size-3 shrink-0" />{p.email}</p>}
          {p.phone && <p className="flex items-center gap-1 truncate"><PhoneIcon className="size-3 shrink-0" />{p.phone}</p>}
          {!p.email && !p.phone && <span>—</span>}
        </div>
      ),
    },
    {
      header: t("col.tier"),
      sortKey: "tier",
      cell: (p) => (
        <Badge variant="outline" className={tierColors[p.tier ?? "standard"]}>
          {p.tier ?? "standard"}
        </Badge>
      ),
    },
    {
      header: t("col.sessions"),
      sortKey: "total_sessions",
      cell: (p) => <span className="text-sm tabular-nums">{p.total_sessions ?? 0}</span>,
    },
    {
      header: t("col.rating"),
      sortKey: "rating",
      cell: (p) =>
        p.rating != null ? (
          <span className="flex items-center gap-1 text-sm">
            <StarIcon className="size-3 fill-amber-400 text-amber-400" />
            {Number(p.rating).toFixed(1)}
            {p.total_reviews ? <span className="text-muted-foreground">({p.total_reviews})</span> : null}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      header: t("col.active"),
      cell: (p) => (
        <Switch checked={p.is_active} disabled={!canManage} onCheckedChange={() => handleToggleActive(p)} />
      ),
    },
  ];

  const rowActions = (p: Provider): RowAction[] => [
    { label: t("action.preview"), icon: EyeIcon, onClick: () => setPreview(p) },
    { label: t("action.edit"), icon: PencilIcon, onClick: () => openEdit(p) },
    {
      label: t("action.delete"),
      icon: Trash2Icon,
      variant: "destructive",
      separatorBefore: true,
      onClick: () => { setDeleting(p); setDeleteError(null); },
    },
  ];

  return (
    <BaseLayout
      maxWidth="full"
      title={t("title")}
      subtitle={t("count", { count: providers.length })}
      action={
        canManage ? (
          <Button onClick={openCreate}>
            <PlusIcon className="size-4 mr-1.5" /> {t("add")}
          </Button>
        ) : undefined
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-8 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger size="sm" className="w-auto min-w-32"><SelectValue placeholder={t("statusPlaceholder")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="active">{t("statusActive")}</SelectItem>
            <SelectItem value="inactive">{t("statusInactive")}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{t("shown", { filtered: filtered.length, total: providers.length })}</span>
      </div>

      <DataTable
        columns={columns}
        data={paged}
        total={sorted.length}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        rowActions={canManage ? rowActions : undefined}
        isLoading={loading}
      />

      {/* Create / edit */}
      <FormSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? t("form.editTitle") : t("form.addTitle")}
        subtitle={editing ? t("form.editSubtitle") : t("form.addSubtitle")}
        icon={editing ? PencilIcon : UserPlusIcon}
        iconAccent="primary"
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t("form.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? t("form.saving") : editing ? t("form.update") : t("form.add")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{saveError}</div>
          )}
          <ProviderForm form={form} setForm={setForm} currency={currency} />
        </div>
      </FormSheet>

      {/* Delete confirmation */}
      <FormSheet
        open={!!deleting}
        onOpenChange={(open) => { if (!open) { setDeleting(null); setDeleteError(null); } }}
        title={t("del.title")}
        subtitle={t("del.subtitle")}
        icon={Trash2Icon}
        iconAccent="destructive"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setDeleting(null); setDeleteError(null); }} disabled={deleteBusy}>{t("del.cancel")}</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleteBusy}>
              {deleteBusy ? t("del.deleting") : t("del.confirm")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm">
            {t.rich("del.confirmText", {
              name: deleting?.name ?? "",
              b: (chunks) => <span className="font-semibold">{chunks}</span>,
            })}
          </p>
          <p className="text-xs text-muted-foreground">{t("del.hint")}</p>
          {deleteError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{deleteError}</div>
          )}
        </div>
      </FormSheet>

      {/* Read-only profile preview */}
      <FormSheet
        open={!!preview}
        onOpenChange={(open) => { if (!open) setPreview(null); }}
        title={t("preview.title")}
        subtitle={t("preview.subtitle")}
        icon={EyeIcon}
        iconAccent="slate"
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreview(null)}>{t("preview.close")}</Button>
            {canManage && preview && (
              <Button onClick={() => { const p = preview; setPreview(null); openEdit(p); }}>
                <PencilIcon className="size-4 mr-1.5" /> {t("preview.edit")}
              </Button>
            )}
          </>
        }
      >
        {preview && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              {preview.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.avatar_url} alt={preview.name} className="size-16 rounded-full object-cover shrink-0" />
              ) : (
                <div className="flex items-center justify-center size-16 rounded-full bg-primary/10 text-primary text-lg font-bold shrink-0">
                  {getInitials(preview.name)}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold truncate">{preview.name}</h3>
                  {preview.is_featured && <StarIcon className="size-4 fill-amber-400 text-amber-400 shrink-0" />}
                </div>
                {preview.title && <p className="text-sm text-muted-foreground">{preview.title}</p>}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge variant="outline" className={tierColors[preview.tier ?? "standard"]}>{preview.tier ?? "standard"}</Badge>
                  <Badge variant="outline" className={preview.is_active ? "" : "opacity-70"}>{preview.is_active ? t("preview.statusActive") : t("preview.statusInactive")}</Badge>
                  {preview.rating != null && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <StarIcon className="size-3 fill-amber-400 text-amber-400" />
                      {Number(preview.rating).toFixed(1)}{preview.total_reviews ? ` (${preview.total_reviews})` : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">{t("preview.email")}</p><p className="truncate">{preview.email || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">{t("preview.phone")}</p><p className="truncate">{preview.phone || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">{t("preview.experience")}</p><p>{preview.experience_years != null ? t("preview.years", { n: preview.experience_years }) : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">{t("preview.rate")}</p><p>{preview.base_rate != null ? formatMoneyWhole(preview.base_rate, currency) : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">{t("preview.sessions")}</p><p>{preview.total_sessions ?? 0}</p></div>
              <div><p className="text-xs text-muted-foreground">{t("preview.displayOrder")}</p><p>{preview.display_order ?? 0}</p></div>
            </div>

            {preview.specializations && preview.specializations.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">{t("preview.specializations")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.specializations.map((s) => (
                    <span key={s} className="text-xs bg-muted px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {preview.short_bio && (
              <div><p className="text-xs text-muted-foreground mb-1">{t("preview.shortBio")}</p><p className="text-sm">{preview.short_bio}</p></div>
            )}
            {preview.bio && (
              <div><p className="text-xs text-muted-foreground mb-1">{t("preview.bio")}</p><p className="text-sm whitespace-pre-wrap">{preview.bio}</p></div>
            )}

            {preview.social_links && Object.keys(preview.social_links).length > 0 && (
              <div className="flex flex-wrap gap-3 text-sm">
                {Object.entries(preview.social_links).map(([k, v]) => (
                  <span key={k} className="text-muted-foreground"><span className="capitalize">{k}</span>: {v}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </FormSheet>
    </BaseLayout>
  );
}
