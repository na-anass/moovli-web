import { InfoIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type StatsCardAccent = "primary" | "emerald" | "sky" | "amber" | "rose";

/** Tinted icon tile per accent. Light and dark variants, same family as BaseLayout. */
const ACCENT_TILES: Record<StatsCardAccent, string> = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
};

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  /** Optional second line under the description (e.g. a forward-looking figure). */
  footnote?: string;
  icon?: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  /** Explains how the metric is calculated; shown via an info icon next to the title. */
  tooltip?: string;
  /**
   * Colors the icon in a tinted tile and shows the trend as a pill. Without it
   * the card stays monochrome (dashboard and admin views).
   */
  accent?: StatsCardAccent;
  className?: string;
}

export function StatsCard({
  title,
  value,
  description,
  footnote,
  icon,
  trend,
  tooltip,
  accent,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-6",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={tooltip}
                  className="inline-flex text-muted-foreground/70 hover:text-foreground transition-colors cursor-help"
                >
                  <InfoIcon className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="max-w-60 text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {icon &&
          (accent ? (
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                ACCENT_TILES[accent],
              )}
            >
              {icon}
            </div>
          ) : (
            <div className="text-muted-foreground">{icon}</div>
          ))}
      </div>
      <div className="mt-2">
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {trend && accent && (
          <span
            className={cn(
              "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              trend.isPositive
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
            )}
          >
            {trend.isPositive ? (
              <TrendingUpIcon className="size-3" />
            ) : (
              <TrendingDownIcon className="size-3" />
            )}
            {trend.isPositive ? "+" : ""}
            {trend.value}%
          </span>
        )}
        {trend && !accent && (
          <p
            className={cn(
              "mt-1 text-xs font-medium",
              trend.isPositive ? "text-green-600" : "text-red-600"
            )}
          >
            {trend.isPositive ? "+" : ""}
            {trend.value}%
          </p>
        )}
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
        {footnote && (
          <p className="mt-1 text-xs font-medium text-foreground/80">{footnote}</p>
        )}
      </div>
    </div>
  );
}
