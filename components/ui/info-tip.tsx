"use client";

import * as React from "react";
import { InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Glossary term keys — must match the `glossary` namespace in messages/*.json.
 */
export type GlossaryTerm =
  | "studio"
  | "moovliPro"
  | "marketplace"
  | "direct"
  | "channel"
  | "commission"
  | "fixedRate"
  | "reconciliation"
  | "checkin"
  | "payout"
  | "wallet"
  | "payzone"
  | "service"
  | "session"
  | "sessionStatus"
  | "capacity"
  | "buffer"
  | "booking"
  | "pendingBooking"
  | "noShow"
  | "customer"
  | "lifetimeValue"
  | "instructor"
  | "bookingPolicies"
  | "freeCancellationWindow"
  | "moovliProSubscription"
  | "endCustomerSubscription"
  | "bookingWidget"
  | "team"
  | "analytics";

/**
 * A small info icon that reveals the localized glossary definition of a term.
 * Usage: `<InfoTip term="wallet" />`
 */
export function InfoTip({
  term,
  className,
  side = "top",
}: {
  term: GlossaryTerm;
  className?: string;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
}) {
  const t = useTranslations("glossary");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t(`${term}.term`)}
          className={cn(
            "inline-flex text-muted-foreground/70 hover:text-foreground transition-colors align-middle cursor-help",
            className
          )}
        >
          <InfoIcon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side}>
        <p className="max-w-56 text-xs">{t(`${term}.tip`)}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Wraps inline text with a dashed underline + glossary tooltip.
 * Usage: `<GlossaryTermLabel term="wallet">Wallet</GlossaryTermLabel>`
 * Falls back to the localized term name when no children are provided.
 */
export function GlossaryTermLabel({
  term,
  children,
  className,
  side = "top",
}: {
  term: GlossaryTerm;
  children?: React.ReactNode;
  className?: string;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
}) {
  const t = useTranslations("glossary");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4",
            className
          )}
        >
          {children ?? t(`${term}.term`)}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side}>
        <p className="max-w-56 text-xs">{t(`${term}.tip`)}</p>
      </TooltipContent>
    </Tooltip>
  );
}
