"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/lib/use-is-mobile";
import { cn } from "@/lib/utils";

// ============================================================================
// FormSheet — single shared shell for every form modal in the studio surface.
//
// Why a single component:
//   - Same shape everywhere: side panel on desktop, bottom sheet on mobile.
//   - Sticky header (title + subtitle + icon) and sticky footer (Cancel/Save)
//     so the body scrolls but the actions stay in place — no more
//     "scroll-to-find-Save-button" pain on long forms (services, schedule).
//   - One place to evolve transitions, theming, accent colors.
//
// Use for:
//   - Create / edit forms (services, instructors, team invite, session, …)
//   - Destructive confirmations (delete service, decline booking) — pass
//     `width="sm"` and a single-line message as children.
// ============================================================================

export type FormSheetWidth = "sm" | "md" | "lg";
export type FormSheetAccent =
  | "primary"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "slate"
  | "destructive";

// Desktop side-panel widths (mobile is always full-width bottom sheet).
const DESKTOP_WIDTH: Record<FormSheetWidth, string> = {
  sm: "sm:max-w-md", // ~28rem — confirmations, tight forms
  md: "sm:max-w-lg", // ~32rem — typical create/edit forms
  lg: "sm:max-w-2xl", // ~42rem — session form with channel allocation etc.
};

const ACCENT_CLASS: Record<FormSheetAccent, string> = {
  primary: "bg-primary/10 text-primary",
  violet: "bg-violet-100 text-violet-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
  slate: "bg-slate-100 text-slate-700",
  destructive: "bg-destructive/10 text-destructive",
};

interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  /** Optional accent icon shown to the left of the title. */
  icon?: React.ElementType;
  /** Accent color for the icon tile. Defaults to primary. */
  iconAccent?: FormSheetAccent;
  /** Caps the desktop side-panel width. Defaults to "md". */
  width?: FormSheetWidth;
  /** Sticky bottom action row — typically Cancel + Save buttons. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function FormSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  icon: Icon,
  iconAccent = "primary",
  width = "md",
  footer,
  children,
}: FormSheetProps) {
  const isMobile = useIsMobile();
  const side = isMobile ? "bottom" : "right";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "flex flex-col gap-0 p-0",
          side === "right" ? cn("w-full", DESKTOP_WIDTH[width]) : "max-h-[90vh] rounded-t-2xl",
        )}
      >
        {/* Sticky header */}
        <SheetHeader className="shrink-0 border-b border-border p-5 gap-0">
          <div className="flex items-start gap-3 pr-8">
            {Icon && (
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  ACCENT_CLASS[iconAccent],
                )}
              >
                <Icon className="size-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base leading-tight">{title}</SheetTitle>
              {subtitle && (
                <SheetDescription className="mt-0.5 text-xs">
                  {subtitle}
                </SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {/* Sticky footer (actions) */}
        {footer && (
          <div className="shrink-0 border-t border-border bg-background p-4 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
