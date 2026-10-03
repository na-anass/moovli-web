"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { LockIcon, TrendingUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEntitlement } from "@/lib/studio/entitlement";
import { isEntitlementError } from "@/lib/api/client";
import type { CapabilityAccess, CapabilityKey } from "@/lib/entitlements/capabilities";

/**
 * Plan gating UI, in one place.
 *
 * Before this, every gated surface built its own amber card / lock badge /
 * upgrade link, so each new gated feature meant new UI and new copy. Here the
 * capability name comes from the admin-editable registry and the copy is
 * generic, which means a brand-new capability needs no new strings and no new
 * component — that is what keeps the eventual Pro launch to data + copy.
 */

const BILLING_HREF = "/studio/billing";

/** The upgrade panel. Also used by error handling when a request is refused. */
export function UpgradeCta({
  capability,
  reason,
  limit,
  className,
}: {
  capability: CapabilityKey;
  reason: Exclude<CapabilityAccess, "allowed">;
  limit?: number | null;
  className?: string;
}) {
  const t = useTranslations("studioChannels.billing.gate");
  const { capabilityLabel, plan } = useEntitlement();
  const feature = capabilityLabel(capability);

  const body =
    reason === "no_subscription"
      ? t("noSubscriptionBody", { feature })
      : reason === "limit_reached"
        ? t("limitReachedBody", { feature, limit: limit ?? 0 })
        : t("notInPlanBody", { feature, plan: plan?.name ?? "" });

  return (
    <div
      className={`rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/40 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <TrendingUpIcon className="size-5 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="font-semibold text-amber-900 dark:text-amber-100">
            {reason === "limit_reached" ? t("limitReachedTitle", { feature }) : t("title", { feature })}
          </p>
          <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">{body}</p>
          <Link href={BILLING_HREF}>
            <Button size="sm" className="mt-3">
              {reason === "no_subscription" ? t("choosePlan") : t("upgradePlan")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Compact lock badge for headers and rows, where a full panel doesn't fit. */
export function UpgradeBadge({ capability }: { capability: CapabilityKey }) {
  const t = useTranslations("studioChannels.billing.gate");
  const { access } = useEntitlement();
  if (access(capability) === "allowed") return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
      <LockIcon className="size-3" />
      {t("planRequiredShort")}
    </span>
  );
}

/** "4 of 5 team members" — shows headroom before a cap bites. */
export function LimitMeter({
  capability,
  className,
}: {
  capability: CapabilityKey;
  className?: string;
}) {
  const t = useTranslations("studioChannels.billing.gate");
  const { limit, usage, capabilityLabel } = useEntitlement();
  const cap = limit(capability);
  if (cap === null) return null; // unlimited — nothing to meter

  const used = usage(capability);
  return (
    <span
      className={`text-xs ${used >= cap ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"} ${className ?? ""}`}
    >
      {t("meter", { used, limit: cap, feature: capabilityLabel(capability) })}
    </span>
  );
}

/**
 * Wrap anything plan-gated.
 *   block   — replace the content with the upgrade panel (default)
 *   overlay — show the panel above the content (content stays usable)
 *   hide    — render nothing
 */
export function EntitlementGate({
  capability,
  mode = "block",
  children,
  fallback,
}: {
  capability: CapabilityKey;
  mode?: "block" | "overlay" | "hide";
  children: React.ReactNode;
  /** Replaces the default panel when you need bespoke copy. */
  fallback?: React.ReactNode;
}) {
  const { access, loading } = useEntitlement();

  // Don't flash a gate before entitlements have loaded.
  if (loading) return <>{children}</>;

  const state = access(capability);
  if (state === "allowed") return <>{children}</>;
  if (mode === "hide") return null;

  const panel = fallback ?? <UpgradeCta capability={capability} reason={state} />;
  if (mode === "overlay") {
    return (
      <>
        {panel}
        {children}
      </>
    );
  }
  return <>{panel}</>;
}

/**
 * Turn a rejected request into the same upgrade panel.
 *
 * Gating can't always be known upfront (a limit is only reached on the Nth
 * write), so the server's 403 is the trigger. Returns a `panel` to render and a
 * `handle` to call from a catch block; anything that isn't an entitlement error
 * is handed back for the caller's own error handling.
 */
export function useEntitlementErrorHandler() {
  const [refusal, setRefusal] = useState<{
    capability: CapabilityKey;
    reason: Exclude<CapabilityAccess, "allowed">;
    limit?: number | null;
  } | null>(null);

  const handle = useCallback((error: unknown): boolean => {
    if (!isEntitlementError(error)) return false;
    setRefusal({
      capability: error.details.capability,
      reason: error.details.reason,
      limit: error.details.limit ?? null,
    });
    return true;
  }, []);

  const clear = useCallback(() => setRefusal(null), []);

  const panel = refusal ? (
    <UpgradeCta
      capability={refusal.capability}
      reason={refusal.reason}
      limit={refusal.limit}
    />
  ) : null;

  return { handle, clear, panel, refusal };
}
