"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { Button } from "@/components/ui/button";
import { DialogsProvider, useDialogs } from "@/components/shared/dialogs";
import { cn } from "@/lib/utils";
import { useOnboarding } from "./_lib/useOnboarding";
import { OnboardingStepper, type StageKey } from "./_components/OnboardingStepper";
import { StudioStage, STUDIO_TABS, type StudioTab } from "./_components/StudioStage";
import { PlanningStage } from "./_components/PlanningStage";
import { PublishStage } from "./_components/PublishStage";

export default function StudioOnboardingPage() {
  const tc = useTranslations("common");
  return (
    <Suspense fallback={<Centered>{tc("loading")}</Centered>}>
      <DialogsProvider>
        <OnboardingInner />
      </DialogsProvider>
    </Suspense>
  );
}

function OnboardingInner() {
  const { roles, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify } = useDialogs();
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");

  const owned = roles?.ownedEntities?.[0];
  const entityId = owned?.entityId;
  const entityName = owned?.entityName;
  const onboardedAt = owned?.onboardedAt;
  const currency = owned?.currencyCode ?? "MAD";

  // Already onboarded → leave.
  useEffect(() => {
    if (!authLoading && onboardedAt) router.replace("/studio/dashboard");
  }, [authLoading, onboardedAt, router]);

  const initialStage = (searchParams.get("stage") as StageKey) || "studio";
  const [stage, setStage] = useState<StageKey>(
    ["studio", "planning", "publish"].includes(initialStage) ? initialStage : "studio",
  );
  const [studioTab, setStudioTab] = useState<StudioTab>("profile");
  const [advancing, setAdvancing] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const planningCommit = useRef<(() => Promise<boolean>) | null>(null);

  const data = useOnboarding(entityId ?? "", currency);

  const skip = async () => {
    if (!entityId) return;
    setFinishing(true);
    try {
      await studioApi.completeOnboarding(entityId);
      window.location.href = "/studio/dashboard";
    } catch (e) {
      notify((e as Error).message, { variant: "error" });
      setFinishing(false);
    }
  };

  const finish = async () => {
    if (!entityId) return;
    setFinishing(true);
    try {
      await studioApi.completeOnboarding(entityId);
      // Hard navigation so AuthProvider refetches roles with the new onboarded_at.
      window.location.href = "/studio/dashboard";
    } catch (e) {
      notify((e as Error).message, { variant: "error" });
      setFinishing(false);
    }
  };

  const goBack = () => {
    if (stage === "studio") {
      const idx = STUDIO_TABS.findIndex((t) => t.key === studioTab);
      if (idx > 0) setStudioTab(STUDIO_TABS[idx - 1].key);
      return;
    }
    if (stage === "planning") {
      setStage("studio");
      setStudioTab("team");
      return;
    }
    if (stage === "publish") setStage("planning");
  };

  const goNext = async () => {
    if (stage === "studio") {
      const idx = STUDIO_TABS.findIndex((t) => t.key === studioTab);
      if (idx < STUDIO_TABS.length - 1) {
        setStudioTab(STUDIO_TABS[idx + 1].key);
        return;
      }
      // Leaving Studio → Planning. Require a name + at least one service.
      if (!data.profile.name.trim()) {
        setStudioTab("profile");
        notify(t("studio.errors.nameRequired"), { title: t("common.almostThere") });
        return;
      }
      if (data.services.length === 0) {
        setStudioTab("services");
        notify(t("studio.errors.serviceRequired"), { title: t("common.almostThere") });
        return;
      }
      setStage("planning");
      return;
    }

    if (stage === "planning") {
      setAdvancing(true);
      try {
        const ok = (await planningCommit.current?.()) ?? true;
        if (ok) setStage("publish");
      } finally {
        setAdvancing(false);
      }
      return;
    }

    if (stage === "publish") finish();
  };

  const jumpTo = (key: StageKey) => {
    if (key === "studio") setStudioTab("profile");
    setStage(key);
  };

  // Skip is offered only on steps whose absence doesn't break the flow:
  // Policies, Team, and Planning. Profile (name) and Services (≥1) stay required.
  const canSkip =
    stage === "planning" ||
    (stage === "studio" && (studioTab === "policies" || studioTab === "team"));

  const skipStep = () => {
    if (stage === "studio" && studioTab === "policies") return setStudioTab("services");
    if (stage === "studio" && studioTab === "team") return setStage("planning");
    if (stage === "planning") return setStage("publish"); // discard unsaved proposals
  };

  // Flat step index across the whole wizard, for the progress bar.
  const TOTAL_STEPS = STUDIO_TABS.length + 2; // 4 studio sub-tabs + planning + publish
  const stepIndex =
    stage === "studio"
      ? STUDIO_TABS.findIndex((t) => t.key === studioTab)
      : stage === "planning"
        ? STUDIO_TABS.length
        : STUDIO_TABS.length + 1;
  const progressPct = Math.round(((stepIndex + 1) / TOTAL_STEPS) * 100);

  const nextLabel = useMemo(() => {
    if (stage === "publish") return t("publish.finishSetup");
    return t("common.continue");
  }, [stage, t]);

  if (authLoading || !entityId) return <Centered>{tc("loading")}</Centered>;

  return (
    <div className="flex h-screen flex-col bg-muted/20">
      {/* Top bar (fixed) */}
      <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Image
              src="/img/moovli-icon.png"
              alt="Moovli"
              width={28}
              height={28}
              className="shrink-0 rounded-md"
            />
            <span className="truncate text-sm font-semibold">
              {entityName ?? t("studioSetup")}
            </span>
          </div>

          <div className="hidden sm:block">
            <OnboardingStepper current={stage} onJump={jumpTo} />
          </div>

          <button
            onClick={skip}
            disabled={finishing}
            className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
          >
            {t("setUpLater")}
          </button>
        </div>
        {/* Compact stepper on mobile */}
        <div className="border-t px-6 py-3 sm:hidden">
          <OnboardingStepper current={stage} onJump={jumpTo} />
        </div>
        {/* Slim progress bar */}
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      {/* Body (only this scrolls) */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            {data.loading ? (
              <div className="space-y-4">
                <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
                <div className="h-32 animate-pulse rounded bg-muted" />
              </div>
            ) : stage === "studio" ? (
              <StudioStage data={data} activeTab={studioTab} onTabChange={setStudioTab} />
            ) : stage === "planning" ? (
              <PlanningStage data={data} commitRef={planningCommit} />
            ) : (
              <PublishStage data={data} />
            )}
          </div>
        </div>
      </main>

      {/* Footer (fixed) */}
      <footer className="shrink-0 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={stage === "studio" && studioTab === "profile"}
          >
            <ArrowLeftIcon className="mr-1.5 size-4" /> {tc("back")}
          </Button>

          <div className="flex items-center gap-2 sm:gap-3">
            <span
              className={cn(
                "hidden items-center gap-1.5 text-xs text-muted-foreground transition-opacity sm:flex",
                data.saved ? "opacity-100" : "opacity-0",
              )}
            >
              <span className="size-1.5 rounded-full bg-emerald-500" /> {t("common.saved")}
            </span>
            {canSkip && (
              <Button
                variant="ghost"
                onClick={skipStep}
                disabled={advancing || finishing}
                className="text-muted-foreground hover:text-foreground"
              >
                {t("common.skip")}
              </Button>
            )}
            <Button onClick={goNext} disabled={advancing || finishing} size="lg">
              {finishing ? t("common.finishing") : advancing ? tc("saving") : nextLabel}
              {!finishing && !advancing && <ArrowRightIcon className="ml-1.5 size-4" />}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
