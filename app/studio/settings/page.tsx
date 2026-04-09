"use client";

import { useEffect, useState } from "react";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  FormLayout,
  FormSection,
  FormField,
} from "@/components/shared/form-layout";
import {
  BuildingIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  GlobeIcon,
  ClockIcon,
  ImageIcon,
} from "lucide-react";
import Image from "next/image";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

type OperatingHours = Record<string, DayHours>;

export default function SettingsPage() {
  const { roles } = useAuth();
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

  const entityId = roles?.ownedEntities?.[0]?.entityId;
  const currentRole = roles?.ownedEntities?.[0]?.role;
  const canEdit = currentRole === "manager" || currentRole === "owner" || roles?.isAdmin;

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

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="h-48 rounded-xl border border-border bg-card animate-pulse" />
        <div className="h-96 rounded-xl border border-border bg-card animate-pulse" />
      </div>
    );
  }

  if (!entity) return <p className="text-muted-foreground">Entity not found.</p>;

  return (
    <div className="max-w-4xl">
      <FormLayout
        title="Settings"
        editing={editing}
        canEdit={!!canEdit}
        saving={saving}
        success={success}
        onEdit={() => setEditing(true)}
        onSave={handleSave}
        onCancel={handleCancel}
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
        </div>
      </FormLayout>
    </div>
  );
}
