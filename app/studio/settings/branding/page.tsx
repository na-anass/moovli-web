"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { studioApi, type EntityMedia } from "@/lib/api/studio";
import { createClient } from "@/lib/supabase/client";
import { useActiveEntity } from "@/lib/studio/active-entity";
import { useSettings } from "@/lib/studio/settings-context";
import { SettingsHeader } from "@/components/studio/settings-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormSection,
  FormField,
  useEditModeSync,
} from "@/components/shared/form-layout";
import {
  BuildingIcon,
  CheckIcon,
  ImageIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";

export default function BrandingSettingsPage() {
  const t = useTranslations("studioSettings.branding");
  const tc = useTranslations("common");
  const { entity, loading, canEdit, updateProfile, refresh } = useSettings();
  const { entityId } = useActiveEntity();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ logo_url: "", cover_image_url: "" });

  const startEditing = () => {
    setForm({
      logo_url: entity?.logo_url || "",
      cover_image_url: entity?.cover_image_url || "",
    });
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
    setForm({
      logo_url: entity?.logo_url || "",
      cover_image_url: entity?.cover_image_url || "",
    });
    setEditing(false);
  };

  useEditModeSync({
    editing,
    saving,
    title: "Branding",
    onSave: handleSave,
    onCancel: handleCancel,
  });

  if (loading) {
    return <div className="h-96 rounded-xl border border-border bg-card animate-pulse" />;
  }
  if (!entity) return <p className="text-muted-foreground">{t("entityNotFound")}</p>;

  const cover = editing ? form.cover_image_url : entity.cover_image_url;
  const logo = editing ? form.logo_url : entity.logo_url;

  return (
    <div className="space-y-6">
      <SettingsHeader
        title={t("title")}
        description={t("description")}
        action={
          <>
            {success && (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 gap-1">
                <CheckIcon className="size-3" /> {tc("success")}
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
                {tc("edit")}
              </Button>
            )}
          </>
        }
      />

      {/* Cover + Logo preview */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {cover ? (
          <div className="h-44 relative">
            <Image src={cover} alt={t("coverAlt")} fill className="object-cover" />
          </div>
        ) : (
          <div className="h-44 bg-gradient-to-r from-primary/20 to-secondary/20 flex items-center justify-center">
            <ImageIcon className="size-10 text-muted-foreground" />
          </div>
        )}
        <div className="px-6 pb-6 -mt-10 relative">
          <div className="flex items-end gap-4">
            {logo ? (
              <Image
                src={logo}
                alt={entity.name}
                width={80}
                height={80}
                className="rounded-xl border-4 border-background object-cover"
              />
            ) : (
              <div className="size-20 rounded-xl border-4 border-background bg-primary/10 flex items-center justify-center">
                <BuildingIcon className="size-8 text-primary" />
              </div>
            )}
            <div className="pb-1">
              <h2 className="text-xl font-bold">{entity.name}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Media URLs (edit only) */}
      {editing && (
        <FormSection title={t("logoAndCover")} icon={<ImageIcon className="size-5" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label={t("logoUrl")} editing={editing} value={entity.logo_url}
              formValue={form.logo_url} onChange={(v) => setForm({ ...form, logo_url: v })}
              placeholder="https://..." />
            <FormField label={t("coverImageUrl")} editing={editing} value={entity.cover_image_url}
              formValue={form.cover_image_url} onChange={(v) => setForm({ ...form, cover_image_url: v })}
              placeholder="https://..." />
          </div>
        </FormSection>
      )}

      {/* Photo gallery */}
      {entityId && (
        <GalleryManager entityId={entityId} canEdit={!!canEdit} onCoverChange={refresh} />
      )}
    </div>
  );
}

// ── Gallery manager ──────────────────────────────────────────────────────────
// Studio photos backed by entity_media. The "Set as cover" star marks the
// default cover (is_primary), which the API also syncs to entities.cover_image_url.
function GalleryManager({
  entityId,
  canEdit,
  onCoverChange,
}: {
  entityId: string;
  canEdit: boolean;
  onCoverChange?: () => void;
}) {
  const t = useTranslations("studioSettings.branding");
  const [photos, setPhotos] = useState<EntityMedia[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

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

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert(t("chooseImageFile"));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert(t("imageTooLarge"));
      return;
    }
    setBusy(true);
    try {
      // 1) mint a signed upload URL, 2) upload straight to Storage, 3) record it.
      const { data: up } = await studioApi.createMediaUploadUrl(entityId, {
        filename: file.name,
        contentType: file.type,
      });
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(up.bucket)
        .uploadToSignedUrl(up.path, up.token, file, { contentType: file.type });
      if (error) throw error;
      await studioApi.addMedia(entityId, { url: up.publicUrl, title: file.name });
      refresh();
    } catch (e) {
      alert((e as Error).message || t("uploadFailed"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const setCover = async (id: string) => {
    setBusy(true);
    try {
      await studioApi.setPrimaryMedia(entityId, id);
      refresh();
      onCoverChange?.();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t("removePhotoConfirm"))) return;
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
    <FormSection title={t("photoGallery")} icon={<ImageIcon className="size-5" />}>
      {canEdit && (
        <div className="space-y-2 mb-4">
          {/* Upload from device */}
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={busy}>
              <UploadIcon className="size-4 mr-1.5" />
              {busy ? t("uploading") : t("uploadPhoto")}
            </Button>
            <span className="text-xs text-muted-foreground">{t("uploadHint")}</span>
          </div>
          {/* Or add by URL */}
          <div className="flex gap-2">
            <Input
              placeholder={t("pasteUrlPlaceholder")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPhoto()}
            />
            <Button variant="outline" onClick={addPhoto} disabled={busy || !url.trim()}>
              <PlusIcon className="size-4 mr-1.5" /> {t("add")}
            </Button>
          </div>
        </div>
      )}

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("noPhotos")} {canEdit ? t("noPhotosHint") : ""}
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.title ?? ""} className="size-full object-cover" />
              {p.is_primary && (
                <Badge className="absolute left-1.5 top-1.5 gap-1 bg-primary text-primary-foreground text-[10px]">
                  <StarIcon className="size-2.5 fill-current" /> {t("cover")}
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
                      <StarIcon className="size-3 mr-1" /> {t("cover")}
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
