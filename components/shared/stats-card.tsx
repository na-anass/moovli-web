import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="mt-2">
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {trend && (
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
