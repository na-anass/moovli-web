"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, CheckIcon, SparklesIcon, XIcon } from "lucide-react";
import { studioApi, type SetupStatus, type SetupStepKey } from "@/lib/api/studio";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

/** Where each incomplete step sends the user to finish it. */
const STEP_HREF: Record<SetupStepKey, string> = {
  profile: "/studio/settings/general",
  services: "/studio/services",
  schedule: "/studio/schedule",
  team: "/studio/instructors",
  policies: "/studio/settings/policies",
  payout: "/studio/settings/payouts",
};

const dismissKey = (entityId: string) => `moovli:setup-dismissed:${entityId}`;

export function SetupChecklist({ entityId }: { entityId: string }) {
  const t = useTranslations("studioMain");
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [dismissed, setDismissed] = useState(true); // default hidden until we know

  useEffect(() => {
    if (!entityId) return;
    let active = true;
    setDismissed(
      typeof window !== "undefined" &&
        window.localStorage.getItem(dismissKey(entityId)) === "1",
    );
    studioApi
      .getSetupStatus(entityId)
      .then((res) => {
        if (active) setStatus(res.data);
      })
      .catch(() => {
        /* non-fatal: hide the card on error */
      });
    return () => {
      active = false;
    };
  }, [entityId]);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(dismissKey(entityId), "1");
    } catch {
      /* ignore storage failures */
    }
  };

  // Hide when finished, dismissed, or not loaded yet.
  if (!status || status.overallComplete || dismissed) return null;

  const doneCount = status.steps.filter((s) => s.complete).length;

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <SparklesIcon className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{t("setup.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("setup.subtitle")}</p>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label={t("setup.dismiss")}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Progress value={status.completionPercentage} className="h-2 flex-1" />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {t("setup.progress", { done: doneCount, total: status.steps.length })}
        </span>
      </div>

      <ul className="mt-4 space-y-1">
        {status.steps.map((step) => (
          <li key={step.key}>
            {step.complete ? (
              <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  <CheckIcon className="size-3.5" />
                </span>
                <span className="line-through">{t(`setup.steps.${step.key}`)}</span>
              </div>
            ) : (
              <Link
                href={STEP_HREF[step.key]}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted"
              >
                <span className="size-5 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                <span className="flex-1 font-medium">{t(`setup.steps.${step.key}`)}</span>
                <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <Button asChild size="sm">
          <Link href="/studio/onboarding?reopen=true">
            {t("setup.resume")}
            <ArrowRightIcon className="ml-1.5 size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
