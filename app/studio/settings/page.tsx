"use client";

import { useEffect, useState } from "react";
import { studioApi } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import { BaseLayout } from "@/components/layout/base-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  FormSection,
  FormField,
  useEditModeSync,
} from "@/components/shared/form-layout";
import {
  BuildingIcon,
  CheckIcon,
  ClockIcon,
  GlobeIcon,
  ImageIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { type EntityMedia } from "@/lib/api/studio";
import Image from "next/image";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

type OperatingHours = Record<string, DayHours>;

export default function SettingsPage() {
  const activeEntity = useActiveEntity();
  const [entity, setEntity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    short_description: "",
    email: "",
    phone: "",
    website: "",
    address_line1: "",
    address_line2: "",
    city: "",
    region: "",
    postal_code: "",
    logo_url: "",
    cover_image_url: "",
  });

  const [hours, setHours] = useState<OperatingHours>({});

  const entityId = activeEntity.entityId;
  const currentRole = activeEntity.role;
  const canEdit = currentRole === "manager" || currentRole === "owner";

  const syncForm = (e: any) => {
    setForm({
      name: e.name || "",
      description: e.description || "",
      short_description: e.short_description || "",
      email: e.email || "",
      phone: e.phone || "",
      website: e.website || "",
      address_line1: e.address_line1 || "",
      address_line2: e.address_line2 || "",
      city: e.city || "",
      region: e.region || "",
      postal_code: e.postal_code || "",
      logo_url: e.logo_url || "",
      cover_image_url: e.cover_image_url || "",
    });
    if (e.operating_hours) setHours(e.operating_hours);
  };

  useEffect(() => {
    if (!entityId) return;
    studioApi
      .getProfile(entityId)
      .then((res) => {
        setEntity(res.data);
        syncForm(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityId]);

  const handleSave = async () => {
    if (!entityId) return;
    setSaving(true);
    setSuccess(false);
    try {
      const res = await studioApi.updateProfile(entityId, { ...form, operating_hours: hours });
      setEntity({ ...entity, ...res.data });
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (entity) syncForm(entity);
    setEditing(false);
  };

  const updateDay = (day: string, field: keyof DayHours, value: string | boolean) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  // Sync edit state to the top bar (must run on every render path, before any early return).
  useEditModeSync({
    editing,
    saving,
    title: "Settings",
    onSave: handleSave,
    onCancel: handleCancel,
  });

  if (loading) {
    return (
      <BaseLayout maxWidth="lg" title="Settings">
        <div className="h-48 rounded-xl border border-border bg-card animate-pulse" />
        <div className="h-96 rounded-xl border border-border bg-card animate-pulse" />
      </BaseLayout>
    );
  }

  if (!entity) return <p className="text-muted-foreground">Entity not found.</p>;

  return (
    <BaseLayout
      maxWidth="lg"
      title="Settings"
      action={
        <>
          {success && (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 gap-1">
              <CheckIcon className="size-3" /> Saved
            </Badge>
          )}
          {canEdit && !editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <PencilIcon className="size-3.5" />
              Edit
            </Button>
          )}
        </>
      }
    >
        <div className="space-y-6">
          {/* Cover + Logo Header */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {(editing ? form.cover_image_url : entity.cover_image_url) ? (
              <div className="h-44 relative">
                <Image
                  src={editing ? form.cover_image_url : entity.cover_image_url}
                  alt="Cover"
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="h-44 bg-gradient-to-r from-primary/20 to-secondary/20 flex items-center justify-center">
                <ImageIcon className="size-10 text-muted-foreground" />
              </div>
            )}
            <div className="px-6 pb-6 -mt-10 relative">
              <div className="flex items-end gap-4">
                {(editing ? form.logo_url : entity.logo_url) ? (
                  <Image
                    src={editing ? form.logo_url : entity.logo_url}
                    alt={entity.name}
                    width={80}
                    height={80}
                    className="rounded-xl border-4 border-background shadow-md object-cover"
                  />
                ) : (
                  <div className="size-20 rounded-xl border-4 border-background bg-primary/10 flex items-center justify-center shadow-md">
                    <BuildingIcon className="size-8 text-primary" />
                  </div>
                )}
                <div className="pb-1">
                  <h2 className="text-xl font-bold">{editing ? form.name : entity.name}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline">{entity.status}</Badge>
                    {entity.entity_type && <Badge variant="outline">{entity.entity_type.name}</Badge>}
                    {entity.is_partner && (
                      <Badge className="bg-primary/10 text-primary">{entity.partnership_tier}</Badge>
                    )}
                    {entity.total_reviews > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {entity.platform_rating ?? "—"} ({entity.total_reviews} reviews)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Media URLs (edit only) */}
          {editing && (
            <FormSection title="Media" icon={<ImageIcon className="size-5" />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField label="Logo URL" editing={editing} value={entity.logo_url}
                  formValue={form.logo_url} onChange={(v) => setForm({ ...form, logo_url: v })}
                  placeholder="https://..." />
                <FormField label="Cover Image URL" editing={editing} value={entity.cover_image_url}
                  formValue={form.cover_image_url} onChange={(v) => setForm({ ...form, cover_image_url: v })}
                  placeholder="https://..." />
              </div>
            </FormSection>
          )}

          {/* Studio Information */}
          <FormSection title="Studio Information" icon={<BuildingIcon className="size-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Studio Name" icon={<BuildingIcon className="size-3.5" />} span={2}
                editing={editing} value={entity.name} formValue={form.name}
                onChange={(v) => setForm({ ...form, name: v })} />
              <FormField label="Description" span={2} multiline
                editing={editing} value={entity.description} formValue={form.description}
                onChange={(v) => setForm({ ...form, description: v })} />
              <FormField label="Short Description" span={2}
                editing={editing} value={entity.short_description} formValue={form.short_description}
                onChange={(v) => setForm({ ...form, short_description: v })} />
              <FormField label="Email" icon={<MailIcon className="size-3.5" />} type="email"
                editing={editing} value={entity.email} formValue={form.email}
                onChange={(v) => setForm({ ...form, email: v })} />
              <FormField label="Phone" icon={<PhoneIcon className="size-3.5" />}
                editing={editing} value={entity.phone} formValue={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })} />
              <FormField label="Website" icon={<GlobeIcon className="size-3.5" />} span={2}
                editing={editing} value={entity.website} formValue={form.website}
                onChange={(v) => setForm({ ...form, website: v })} placeholder="https://" />
            </div>
          </FormSection>

          {/* Location */}
          <FormSection title="Location" icon={<MapPinIcon className="size-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Address" span={2} editing={editing}
                value={entity.address_line1} formValue={form.address_line1}
                onChange={(v) => setForm({ ...form, address_line1: v })} />
              <FormField label="Address Line 2" span={2} editing={editing}
                value={entity.address_line2} formValue={form.address_line2}
                onChange={(v) => setForm({ ...form, address_line2: v })} />
              <FormField label="City" editing={editing}
                value={entity.city} formValue={form.city}
                onChange={(v) => setForm({ ...form, city: v })} />
              <FormField label="Region" editing={editing}
                value={entity.region} formValue={form.region}
                onChange={(v) => setForm({ ...form, region: v })} />
              <FormField label="Postal Code" editing={editing}
                value={entity.postal_code} formValue={form.postal_code}
                onChange={(v) => setForm({ ...form, postal_code: v })} />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Country</label>
                <p className="mt-1.5 text-foreground">{entity.country || "MA"}</p>
              </div>
            </div>
          </FormSection>

          {/* Operating Hours */}
          <FormSection title="Operating Hours" icon={<ClockIcon className="size-5" />}>
            <div className="space-y-2">
              {DAYS.map((day) => {
                const dayHours = hours[day] || { open: "09:00", close: "18:00", closed: false };
                return (
                  <div
                    key={day}
                    className="flex items-center gap-4 rounded-lg border border-border px-4 py-3"
                  >
                    <span className="text-sm font-medium capitalize w-24 shrink-0">{day}</span>

                    {editing ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!dayHours.closed}
                            onCheckedChange={(checked) => updateDay(day, "closed", !checked)}
                          />
                          <span className="text-xs text-muted-foreground w-10">
                            {dayHours.closed ? "Closed" : "Open"}
                          </span>
                        </div>
                        {!dayHours.closed ? (
                          <div className="flex items-center gap-2 ml-auto">
                            <Input
                              type="time"
                              className="w-28 h-8 text-sm"
                              value={dayHours.open}
                              onChange={(e) => updateDay(day, "open", e.target.value)}
                            />
                            <span className="text-muted-foreground text-sm">to</span>
                            <Input
                              type="time"
                              className="w-28 h-8 text-sm"
                              value={dayHours.close}
                              onChange={(e) => updateDay(day, "close", e.target.value)}
                            />
                          </div>
                        ) : (
                          <span className="ml-auto text-sm text-muted-foreground">Closed</span>
                        )}
                      </>
                    ) : (
                      <span className="ml-auto text-sm">
                        {dayHours.closed ? (
                          <span className="text-muted-foreground">Closed</span>
                        ) : (
                          <span className="text-foreground">{dayHours.open} — {dayHours.close}</span>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </FormSection>

          {/* Photo gallery */}
          {entityId && <GalleryManager entityId={entityId} canEdit={!!canEdit} />}
        </div>
    </BaseLayout>
  );
}

// ── Gallery manager ──────────────────────────────────────────────────────────
// Studio photos backed by entity_media. The "Set as cover" star marks the
// default cover (is_primary), which the API also syncs to entities.cover_image_url.
function GalleryManager({ entityId, canEdit }: { entityId: string; canEdit: boolean }) {
  const [photos, setPhotos] = useState<EntityMedia[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    studioApi
      .getMedia(entityId)
      .then((res) => setPhotos(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  const addPhoto = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await studioApi.addMedia(entityId, { url: trimmed });
      setUrl("");
      refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setCover = async (id: string) => {
    setBusy(true);
    try {
      await studioApi.setPrimaryMedia(entityId, id);
      refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this photo?")) return;
    setBusy(true);
    try {
      await studioApi.deleteMedia(entityId, id);
      refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSection title="Photo gallery" icon={<ImageIcon className="size-5" />}>
      {canEdit && (
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Paste an image URL…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPhoto()}
          />
          <Button onClick={addPhoto} disabled={busy || !url.trim()}>
            <PlusIcon className="size-4 mr-1.5" /> Add photo
          </Button>
        </div>
      )}

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No photos yet. {canEdit ? "Add image URLs to build your gallery." : ""}
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.title ?? ""} className="size-full object-cover" />
              {p.is_primary && (
                <Badge className="absolute left-1.5 top-1.5 gap-1 bg-primary text-primary-foreground text-[10px]">
                  <StarIcon className="size-2.5 fill-current" /> Cover
                </Badge>
              )}
              {canEdit && (
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {!p.is_primary && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px]"
                      disabled={busy}
                      onClick={() => setCover(p.id)}
                    >
                      <StarIcon className="size-3 mr-1" /> Cover
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="secondary"
                    className="size-7 text-destructive"
                    disabled={busy}
                    onClick={() => remove(p.id)}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </FormSection>
  );
}
