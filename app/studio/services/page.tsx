"use client";

import { useEffect, useState } from "react";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PlusIcon,
  PencilIcon,
  ClockIcon,
  UsersIcon,
  CoinsIcon,
  StarIcon,
  PackageIcon,
} from "lucide-react";

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
}

const EMPTY_FORM = {
  name: "",
  description: "",
  short_description: "",
  base_price: "",
  credit_price: "",
  duration_minutes: "",
  capacity: "",
  min_capacity: "",
  booking_buffer_minutes: "15",
  cancellation_hours: "24",
  is_featured: false,
};

export default function ServicesPage() {
  const { roles } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const entityId = roles?.ownedEntities?.[0]?.entityId;
  const currentRole = roles?.ownedEntities?.[0]?.role;
  const canManage = currentRole === "manager" || currentRole === "owner" || roles?.isAdmin;

  const fetchServices = () => {
    if (!entityId) return;
    studioApi
      .getServices(entityId, true) // all=true to include inactive
      .then((res) => setServices(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchServices(); }, [entityId]);

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
      credit_price: String(s.credit_price || ""),
      duration_minutes: String(s.duration_minutes),
      capacity: String(s.capacity),
      min_capacity: String(s.min_capacity || ""),
      booking_buffer_minutes: String(s.booking_buffer_minutes ?? 15),
      cancellation_hours: String(s.cancellation_hours ?? 24),
      is_featured: s.is_featured,
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
        credit_price: parseInt(form.credit_price) || null,
        duration_minutes: parseInt(form.duration_minutes) || 60,
        capacity: parseInt(form.capacity) || 10,
        min_capacity: parseInt(form.min_capacity) || null,
        booking_buffer_minutes: parseInt(form.booking_buffer_minutes) || 15,
        cancellation_hours: parseInt(form.cancellation_hours) || 24,
        is_featured: form.is_featured,
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
    try {
      await studioApi.updateService(entityId, s.id, { is_active: !s.is_active });
      fetchServices();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Services</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const activeCount = services.filter((s) => s.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Services</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} active · {services.length - activeCount} inactive
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <PlusIcon className="size-4 mr-2" />
            New Service
          </Button>
        )}
      </div>

      {services.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <PackageIcon className="size-6 text-primary" />
          </div>
          <h3 className="font-semibold">No services yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Create your first service to start scheduling sessions.
          </p>
          {canManage && (
            <Button className="mt-4" onClick={openCreate}>
              <PlusIcon className="size-4 mr-2" />
              Create Service
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border bg-card transition-all ${
                s.is_active
                  ? "border-border hover:shadow-sm"
                  : "border-border/50 opacity-60"
              }`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{s.name}</h3>
                      {s.is_featured && (
                        <StarIcon className="size-3.5 fill-amber-400 text-amber-400 shrink-0" />
                      )}
                    </div>
                    {s.short_description && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">{s.short_description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {!s.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                    {canManage && (
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(s)}>
                        <PencilIcon className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 mt-4 flex-wrap">
                  <div className="flex items-center gap-1.5 text-sm">
                    <ClockIcon className="size-3.5 text-muted-foreground" />
                    <span>{s.duration_minutes} min</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <UsersIcon className="size-3.5 text-muted-foreground" />
                    <span>{s.capacity} spots</span>
                  </div>
                  {s.credit_price && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <CoinsIcon className="size-3.5 text-muted-foreground" />
                      <span>{s.credit_price} credits</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-muted-foreground">{s.base_price} {s.currency || "MAD"}</span>
                  </div>
                </div>

                {/* Description */}
                {s.description && (
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{s.description}</p>
                )}
              </div>

              {/* Footer with toggle */}
              {canManage && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Buffer: {s.booking_buffer_minutes ?? 15}min · Cancel: {s.cancellation_hours ?? 24}h
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{s.is_active ? "Active" : "Inactive"}</span>
                    <Switch
                      checked={s.is_active}
                      onCheckedChange={() => handleToggleActive(s)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Service" : "New Service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input className="mt-1.5" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Megaformer Pilates" />
            </div>

            <div>
              <label className="text-sm font-medium">Short Description</label>
              <Input className="mt-1.5" value={form.short_description}
                onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                placeholder="One-line summary" maxLength={500} />
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="mt-1.5 w-full rounded-lg border border-border bg-background p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detailed description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <ClockIcon className="size-3" /> Duration (min) *
                </label>
                <Input type="number" className="mt-1.5" value={form.duration_minutes} min="5"
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <UsersIcon className="size-3" /> Capacity *
                </label>
                <Input type="number" className="mt-1.5" value={form.capacity} min="1"
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Price (MAD) *</label>
                <Input type="number" className="mt-1.5" value={form.base_price} min="0" step="0.01"
                  onChange={(e) => setForm({ ...form, base_price: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <CoinsIcon className="size-3" /> Credit Price
                </label>
                <Input type="number" className="mt-1.5" value={form.credit_price} min="1"
                  onChange={(e) => setForm({ ...form, credit_price: e.target.value })}
                  placeholder="Credits per booking" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Min Capacity</label>
                <Input type="number" className="mt-1.5" value={form.min_capacity} min="0"
                  onChange={(e) => setForm({ ...form, min_capacity: e.target.value })}
                  placeholder="Optional" />
              </div>
              <div>
                <label className="text-sm font-medium">Booking Buffer (min)</label>
                <Input type="number" className="mt-1.5" value={form.booking_buffer_minutes} min="0"
                  onChange={(e) => setForm({ ...form, booking_buffer_minutes: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Cancellation Window (hours)</label>
                <Input type="number" className="mt-1.5" value={form.cancellation_hours} min="0"
                  onChange={(e) => setForm({ ...form, cancellation_hours: e.target.value })} />
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

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}
                disabled={saving || !form.name || !form.duration_minutes || !form.capacity || !form.base_price}>
                {saving ? "Saving..." : editingService ? "Update Service" : "Create Service"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
