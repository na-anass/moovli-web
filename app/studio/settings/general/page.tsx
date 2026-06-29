"use client";

import { useState } from "react";
import { useSettings } from "@/lib/studio/settings-context";
import { SettingsHeader } from "@/components/studio/settings-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FormSection,
  FormField,
  useEditModeSync,
} from "@/components/shared/form-layout";
import {
  BuildingIcon,
  CheckIcon,
  GlobeIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
} from "lucide-react";

export default function GeneralSettingsPage() {
  const { entity, loading, canEdit, updateProfile } = useSettings();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
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
  });

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
    });
  };

  const startEditing = () => {
    if (entity) syncForm(entity);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      await updateProfile(form);
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

  useEditModeSync({
    editing,
    saving,
    title: "General",
    onSave: handleSave,
    onCancel: handleCancel,
  });

  if (loading) {
    return <div className="h-96 rounded-xl border border-border bg-card animate-pulse" />;
  }
  if (!entity) return <p className="text-muted-foreground">Entity not found.</p>;

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="General"
        description="Your studio's name, contact details, and location."
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
                onClick={startEditing}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <PencilIcon className="size-3.5" />
                Edit
              </Button>
            )}
          </>
        }
      />

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
    </div>
  );
}
