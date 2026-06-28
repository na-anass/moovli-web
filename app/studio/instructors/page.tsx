"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BaseLayout } from "@/components/layout/base-layout";
import { DataTable, type Column, type RowAction } from "@/components/shared/data-table";
import { FormSheet } from "@/components/shared/form-sheet";
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

const EMPTY_FORM = {
  name: "",
  title: "",
  email: "",
  phone: "",
  tier: "standard",
  experience_years: "",
  base_rate: "",
  specializations: "",
  short_bio: "",
  bio: "",
  avatar_url: "",
  is_active: true,
  is_featured: false,
  display_order: "0",
  instagram: "",
  facebook: "",
};

const PAGE_SIZE = 20;

export default function InstructorsPage() {
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
  const [form, setForm] = useState(EMPTY_FORM);
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
    setForm(EMPTY_FORM);
    setSaveError(null);
    setDialogOpen(true);
  };

  const openEdit = (p: Provider) => {
    setEditing(p);
    setForm({
      name: p.name,
      title: p.title ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      tier: p.tier ?? "standard",
      experience_years: p.experience_years != null ? String(p.experience_years) : "",
      base_rate: p.base_rate != null ? String(p.base_rate) : "",
      specializations: (p.specializations ?? []).join(", "),
      short_bio: p.short_bio ?? "",
      bio: p.bio ?? "",
      avatar_url: p.avatar_url ?? "",
      is_active: p.is_active,
      is_featured: !!p.is_featured,
      display_order: String(p.display_order ?? 0),
      instagram: p.social_links?.instagram ?? "",
      facebook: p.social_links?.facebook ?? "",
    });
    setSaveError(null);
    setDialogOpen(true);
  };

  const buildPayload = () => {
    const specializations = form.specializations
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const social: Record<string, string> = {};
    if (form.instagram.trim()) social.instagram = form.instagram.trim();
    if (form.facebook.trim()) social.facebook = form.facebook.trim();
    return {
      name: form.name.trim(),
      title: form.title.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      tier: form.tier,
      experience_years: form.experience_years ? parseInt(form.experience_years) : null,
      base_rate: form.base_rate ? parseFloat(form.base_rate) : null,
      specializations: specializations.length ? specializations : null,
      short_bio: form.short_bio.trim() || null,
      bio: form.bio.trim() || null,
      avatar_url: form.avatar_url.trim() || null,
      is_active: form.is_active,
      is_featured: form.is_featured,
      display_order: form.display_order ? parseInt(form.display_order) : 0,
      social_links: Object.keys(social).length ? social : null,
    };
  };

  const handleSave = async () => {
    if (!entityId || !form.name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = buildPayload();
      if (editing) await studioApi.updateProvider(entityId, editing.id, payload);
      else await studioApi.createProvider(entityId, payload);
      setDialogOpen(false);
      fetchProviders();
    } catch (e) {
      console.error(e);
      setSaveError((e as Error).message || "Couldn't save instructor. Please try again.");
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
      setDeleteError((e as Error).message || "Couldn't delete instructor.");
    } finally {
      setDeleteBusy(false);
    }
  };

  // ── columns ────────────────────────────────────────────────────────────────
  const columns: Column<Provider>[] = [
    {
      header: "Instructor",
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
      header: "Contact",
      cell: (p) => (
        <div className="text-xs text-muted-foreground space-y-0.5">
          {p.email && <p className="flex items-center gap-1 truncate"><MailIcon className="size-3 shrink-0" />{p.email}</p>}
          {p.phone && <p className="flex items-center gap-1 truncate"><PhoneIcon className="size-3 shrink-0" />{p.phone}</p>}
          {!p.email && !p.phone && <span>—</span>}
        </div>
      ),
    },
    {
      header: "Tier",
      sortKey: "tier",
      cell: (p) => (
        <Badge variant="outline" className={tierColors[p.tier ?? "standard"]}>
          {p.tier ?? "standard"}
        </Badge>
      ),
    },
    {
      header: "Sessions",
      sortKey: "total_sessions",
      cell: (p) => <span className="text-sm tabular-nums">{p.total_sessions ?? 0}</span>,
    },
    {
      header: "Rating",
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
      header: "Active",
      cell: (p) => (
        <Switch checked={p.is_active} disabled={!canManage} onCheckedChange={() => handleToggleActive(p)} />
      ),
    },
  ];

  const rowActions = (p: Provider): RowAction[] => [
    { label: "Preview", icon: EyeIcon, onClick: () => setPreview(p) },
    { label: "Edit", icon: PencilIcon, onClick: () => openEdit(p) },
    {
      label: "Delete",
      icon: Trash2Icon,
      variant: "destructive",
      separatorBefore: true,
      onClick: () => { setDeleting(p); setDeleteError(null); },
    },
  ];

  return (
    <BaseLayout
      maxWidth="full"
      title="Instructors"
      subtitle={`${providers.length} instructor${providers.length !== 1 ? "s" : ""}`}
      action={
        canManage ? (
          <Button onClick={openCreate}>
            <PlusIcon className="size-4 mr-1.5" /> Add instructor
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
            placeholder="Search name, email or title…"
            className="h-8 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger size="sm" className="w-auto min-w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} of {providers.length} shown</span>
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
        title={editing ? "Edit instructor" : "Add instructor"}
        subtitle={editing ? "Update this instructor's profile." : "Add someone who teaches at your studio. Add an email to give them a login."}
        icon={editing ? PencilIcon : UserPlusIcon}
        iconAccent="primary"
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : editing ? "Update instructor" : "Add instructor"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{saveError}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Instructor name" />
            </div>
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input className="mt-1.5" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Senior Pilates Coach" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input className="mt-1.5" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
              <p className="text-[10px] text-muted-foreground mt-1">Adding an email provisions an instructor login.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input className="mt-1.5" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+212…" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Experience (yrs)</label>
              <Input className="mt-1.5" type="number" min="0" value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Rate ({currency})</label>
              <Input className="mt-1.5" type="number" min="0" step="0.01" value={form.base_rate} onChange={(e) => setForm({ ...form, base_rate: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Specializations</label>
            <Input className="mt-1.5" value={form.specializations} onChange={(e) => setForm({ ...form, specializations: e.target.value })} placeholder="Pilates, Yoga, HIIT (comma-separated)" />
          </div>

          <div>
            <label className="text-sm font-medium">Short bio</label>
            <Input className="mt-1.5" value={form.short_bio} onChange={(e) => setForm({ ...form, short_bio: e.target.value })} placeholder="One-line summary" maxLength={500} />
          </div>

          <div>
            <label className="text-sm font-medium">Bio</label>
            <textarea
              className="mt-1.5 w-full rounded-lg border border-border bg-background p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Detailed bio…"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Avatar URL</label>
            <Input className="mt-1.5" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Instagram</label>
              <Input className="mt-1.5" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@handle or URL" />
            </div>
            <div>
              <label className="text-sm font-medium">Facebook</label>
              <Input className="mt-1.5" value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} placeholder="profile or URL" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-sm font-medium">Display order</label>
              <Input className="mt-1.5" type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
              <label className="text-sm font-medium flex items-center gap-1"><StarIcon className="size-3" /> Featured</label>
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <label className="text-sm font-medium">Active</label>
            </div>
          </div>
        </div>
      </FormSheet>

      {/* Delete confirmation */}
      <FormSheet
        open={!!deleting}
        onOpenChange={(open) => { if (!open) { setDeleting(null); setDeleteError(null); } }}
        title="Delete instructor?"
        subtitle="This action cannot be undone."
        icon={Trash2Icon}
        iconAccent="destructive"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setDeleting(null); setDeleteError(null); }} disabled={deleteBusy}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleteBusy}>
              {deleteBusy ? "Deleting…" : "Delete instructor"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm">
            Permanently delete <span className="font-semibold">{deleting?.name}</span>?
          </p>
          <p className="text-xs text-muted-foreground">
            If they're assigned to any sessions, the delete is blocked — deactivate them instead
            (toggle Active off), which hides them without breaking existing bookings.
          </p>
          {deleteError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{deleteError}</div>
          )}
        </div>
      </FormSheet>

      {/* Read-only profile preview */}
      <FormSheet
        open={!!preview}
        onOpenChange={(open) => { if (!open) setPreview(null); }}
        title="Instructor preview"
        subtitle="How this instructor's profile reads."
        icon={EyeIcon}
        iconAccent="slate"
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreview(null)}>Close</Button>
            {canManage && preview && (
              <Button onClick={() => { const p = preview; setPreview(null); openEdit(p); }}>
                <PencilIcon className="size-4 mr-1.5" /> Edit
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
                  <Badge variant="outline" className={preview.is_active ? "" : "opacity-70"}>{preview.is_active ? "Active" : "Inactive"}</Badge>
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
              <div><p className="text-xs text-muted-foreground">Email</p><p className="truncate">{preview.email || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Phone</p><p className="truncate">{preview.phone || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Experience</p><p>{preview.experience_years != null ? `${preview.experience_years} yrs` : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Rate</p><p>{preview.base_rate != null ? formatMoneyWhole(preview.base_rate, currency) : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Sessions</p><p>{preview.total_sessions ?? 0}</p></div>
              <div><p className="text-xs text-muted-foreground">Display order</p><p>{preview.display_order ?? 0}</p></div>
            </div>

            {preview.specializations && preview.specializations.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Specializations</p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.specializations.map((s) => (
                    <span key={s} className="text-xs bg-muted px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {preview.short_bio && (
              <div><p className="text-xs text-muted-foreground mb-1">Short bio</p><p className="text-sm">{preview.short_bio}</p></div>
            )}
            {preview.bio && (
              <div><p className="text-xs text-muted-foreground mb-1">Bio</p><p className="text-sm whitespace-pre-wrap">{preview.bio}</p></div>
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
