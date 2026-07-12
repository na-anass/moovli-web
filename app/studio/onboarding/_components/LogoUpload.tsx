"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, Loader2Icon } from "lucide-react";
import { studioApi } from "@/lib/api/studio";
import { createClient } from "@/lib/supabase/client";
import { useDialogs } from "@/components/shared/dialogs";
import { cn } from "@/lib/utils";

/**
 * Circular logo picker. Reuses the studio media upload flow (mint signed URL →
 * upload straight to Storage → get public URL). The parent decides how to
 * persist the returned URL (here: entities.logo_url via updateProfile).
 */
export function LogoUpload({
  entityId,
  value,
  onUploaded,
}: {
  entityId: string;
  value: string;
  onUploaded: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const { notify } = useDialogs();

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      notify("Please choose an image file.", { title: "Unsupported file" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      notify("Image must be 8MB or smaller.", { title: "File too large" });
      return;
    }
    setBusy(true);
    try {
      const { data: up } = await studioApi.createMediaUploadUrl(entityId, {
        filename: file.name,
        contentType: file.type,
      });
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(up.bucket)
        .uploadToSignedUrl(up.path, up.token, file, { contentType: file.type });
      if (error) throw error;
      onUploaded(up.publicUrl);
    } catch (e) {
      notify((e as Error).message || "Upload failed", { variant: "error" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <button
      type="button"
      onClick={() => fileRef.current?.click()}
      disabled={busy}
      className={cn(
        "group relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-border bg-muted/40 text-center transition hover:border-primary/60 hover:bg-muted",
        busy && "opacity-70",
      )}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
      {value ? (
        <>
          <Image src={value} alt="Logo" fill sizes="96px" className="object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100">
            Change
          </span>
        </>
      ) : busy ? (
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      ) : (
        <span className="flex flex-col items-center gap-1 px-2 text-muted-foreground">
          <ImageIcon className="size-5" />
          <span className="text-[11px] leading-tight">
            Logo
            <br />
            <span className="underline">browse</span>
          </span>
        </span>
      )}
    </button>
  );
}
