"use client";

import { useTranslations } from "next-intl";
import { studioApi } from "@/lib/api/studio";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTip } from "@/components/ui/info-tip";
import { useDialogs } from "@/components/shared/dialogs";
import { PanelHeading } from "./PanelHeading";
import type { OnboardingData } from "../_lib/useOnboarding";

const CANCEL_OPTIONS = [
  { value: 0, key: "none" },
  { value: 2, key: "h2" },
  { value: 12, key: "h12" },
  { value: 24, key: "h24" },
  { value: 48, key: "h48" },
];

const CUTOFF_OPTIONS = [
  { value: 0, key: "start" },
  { value: 30, key: "m30" },
  { value: 60, key: "h1" },
  { value: 120, key: "h2" },
  { value: 1440, key: "d1" },
];

export function PoliciesPanel({ data }: { data: OnboardingData }) {
  const { entityId, policies, setPolicies, flashSaved } = data;
  const { notify } = useDialogs();
  const t = useTranslations("onboarding");

  const persist = async (patch: Partial<typeof policies>) => {
    setPolicies(patch);
    try {
      await studioApi.updatePolicies(entityId, patch);
      flashSaved();
    } catch (e) {
      notify((e as Error).message, { variant: "error" });
    }
  };

  return (
    <div>
      <PanelHeading
        title={t("policies.title")}
        subtitle={t("policies.subtitle")}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-sm font-medium">
            {t("policies.freeCancellationWindow")}
            <InfoTip term="freeCancellationWindow" />
          </label>
          <Select
            value={String(policies.cancellation_free_hours)}
            onValueChange={(v) => persist({ cancellation_free_hours: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANCEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {t(`policies.cancelOptions.${o.key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t("policies.bookingCloses")}
          </label>
          <Select
            value={String(policies.booking_cutoff_minutes)}
            onValueChange={(v) => persist({ booking_cutoff_minutes: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUTOFF_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {t(`policies.cutoffOptions.${o.key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {t("policies.defaultsNote")}
      </p>
    </div>
  );
}
