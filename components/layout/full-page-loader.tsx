"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Consistent full-screen loading state shown by the authenticated role layouts
 * while authorization is being resolved or a guard redirect is in flight.
 *
 * This is the AUTHORIZATION loader — it deliberately renders NO protected chrome
 * so a user is never shown a page (or the wrong page) before we know they're
 * allowed on it. Page-level DATA loading uses BaseLayout skeletons instead.
 */
export function FullPageLoader({ label }: { label?: string }) {
  const t = useTranslations("shared");
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2Icon className="size-6 animate-spin" />
        <p className="text-sm">{label ?? t("loader.label")}</p>
      </div>
    </div>
  );
}
