"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarRangeIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DATE_RANGE_PRESETS,
  MAX_RANGE_DAYS,
  isValidCustomRange,
  resolvePreset,
  type DateRange,
  type DateRangePreset,
} from "@/lib/date-range";

/**
 * Preset picker ("Last 7 days", "This month", …) with a custom from/to option.
 * Controlled: the parent owns the range (typically synced to the URL via
 * `parseDateRange` / `serializeDateRange`).
 */
export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const t = useTranslations("dateRange");

  // Draft days for the custom inputs — only committed once the pair is valid,
  // so typing a half-finished date doesn't refetch or show an error range.
  const [draftFrom, setDraftFrom] = useState(value.from);
  const [draftTo, setDraftTo] = useState(value.to);

  // Re-sync drafts when the committed range changes from outside (preset
  // switch, back/forward navigation) — adjusted during render, not in an effect.
  const [syncedKey, setSyncedKey] = useState(`${value.from}|${value.to}`);
  const valueKey = `${value.from}|${value.to}`;
  if (valueKey !== syncedKey) {
    setSyncedKey(valueKey);
    setDraftFrom(value.from);
    setDraftTo(value.to);
  }

  const handlePreset = (preset: DateRangePreset) => {
    if (preset === "custom") {
      // Start from the currently shown days so the inputs aren't empty.
      onChange({ preset, from: value.from, to: value.to });
    } else {
      onChange(resolvePreset(preset));
    }
  };

  const commitCustom = (from: string, to: string) => {
    setDraftFrom(from);
    setDraftTo(to);
    if (isValidCustomRange(from, to)) onChange({ preset: "custom", from, to });
  };

  const draftInvalid = value.preset === "custom" && !isValidCustomRange(draftFrom, draftTo);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={value.preset} onValueChange={(v) => handlePreset(v as DateRangePreset)}>
        <SelectTrigger size="sm" className="min-w-40" aria-label={t("label")}>
          <CalendarRangeIcon className="size-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          {DATE_RANGE_PRESETS.map((preset) => (
            <SelectItem key={preset} value={preset}>
              {t(`presets.${preset}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            aria-label={t("from")}
            className="h-8 w-38"
            value={draftFrom}
            max={draftTo || undefined}
            aria-invalid={draftInvalid || undefined}
            onChange={(e) => commitCustom(e.target.value, draftTo)}
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="date"
            aria-label={t("to")}
            className="h-8 w-38"
            value={draftTo}
            min={draftFrom || undefined}
            aria-invalid={draftInvalid || undefined}
            onChange={(e) => commitCustom(draftFrom, e.target.value)}
          />
          {draftInvalid && (
            <span className="text-xs text-destructive">
              {t("invalid", { max: MAX_RANGE_DAYS })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
