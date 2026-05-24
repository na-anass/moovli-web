"use client";

import { cn } from "@/lib/utils";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

export type StudioPageWidth = "sm" | "md" | "lg" | "xl" | "full";
export type StudioPageAccent =
  | "primary"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "slate";

const WIDTHS: Record<StudioPageWidth, string> = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-5xl",
  xl: "max-w-7xl",
  full: "max-w-none",
};

const ACCENTS: Record<StudioPageAccent, string> = {
  primary: "bg-primary/10 text-primary",
  violet: "bg-violet-100 text-violet-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
  slate: "bg-slate-100 text-slate-700",
};

interface StudioPageProps {
  title: string;
  subtitle?: string;
  /** Optional accent icon shown to the left of the title. */
  icon?: React.ElementType;
  /** Accent color for the icon tile. Defaults to primary. */
  iconAccent?: StudioPageAccent;
  /** Optional back-link rendered above the title. */
  back?: { href: string; label: string };
  /** Right-aligned slot next to the title (toggles, status badges, single CTA). */
  action?: React.ReactNode;
  /** Sets max-width of the centered content column. Defaults to "md" (3xl). */
  maxWidth?: StudioPageWidth;
  /** Override vertical gap between children. Defaults to space-y-6. */
  gap?: "tight" | "default" | "loose";
  /** Hide the default header block entirely (caller renders its own). */
  hideHeader?: boolean;
  children: React.ReactNode;
}

const GAPS: Record<NonNullable<StudioPageProps["gap"]>, string> = {
  tight: "space-y-4",
  default: "space-y-6",
  loose: "space-y-8",
};

export function StudioPage({
  title,
  subtitle,
  icon: Icon,
  iconAccent = "primary",
  back,
  action,
  maxWidth = "md",
  gap = "default",
  hideHeader = false,
  children,
}: StudioPageProps) {
  return (
    <div className={cn("p-8 mx-auto", WIDTHS[maxWidth], GAPS[gap])}>
      {!hideHeader && (
        <div>
          {back && (
            <Link
              href={back.href}
              className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeftIcon className="size-3 mr-1" />
              {back.label}
            </Link>
          )}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              {Icon && (
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    ACCENTS[iconAccent],
                  )}
                >
                  <Icon className="size-5" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>
            {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
