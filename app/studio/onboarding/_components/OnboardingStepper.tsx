"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type StageKey = "studio" | "planning" | "publish";

export const STAGES: { key: StageKey }[] = [
  { key: "studio" },
  { key: "planning" },
  { key: "publish" },
];

/**
 * The 3-stage top rail: Studio · Planning · Publish. Past stages show a check
 * and a filled connector; the current stage is highlighted; future stages are
 * muted. Stages the user has already passed are clickable to go back.
 */
export function OnboardingStepper({
  current,
  onJump,
}: {
  current: StageKey;
  onJump?: (key: StageKey) => void;
}) {
  const t = useTranslations("onboarding");
  const currentIndex = STAGES.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {STAGES.map((stage, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        const canJump = i < currentIndex && !!onJump;

        return (
          <div key={stage.key} className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              disabled={!canJump}
              onClick={() => canJump && onJump?.(stage.key)}
              className={cn(
                "flex flex-col items-center gap-1.5",
                canJump && "cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  isDone && "bg-emerald-500 text-white",
                  isCurrent && "bg-primary text-primary-foreground",
                  !isDone && !isCurrent && "bg-muted text-muted-foreground",
                )}
              >
                {isDone ? <CheckIcon className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t(`stepper.${stage.key}`)}
              </span>
            </button>

            {i < STAGES.length - 1 && (
              <span
                className={cn(
                  "mb-5 h-0.5 w-10 rounded-full sm:w-20",
                  i < currentIndex ? "bg-emerald-500" : "bg-muted",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
