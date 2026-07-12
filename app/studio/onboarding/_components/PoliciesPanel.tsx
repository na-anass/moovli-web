"use client";

import { studioApi } from "@/lib/api/studio";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDialogs } from "@/components/shared/dialogs";
import { PanelHeading } from "./PanelHeading";
import type { OnboardingData } from "../_lib/useOnboarding";

const CANCEL_OPTIONS = [
  { value: 0, label: "No free cancellation" },
  { value: 2, label: "2 hours before" },
  { value: 12, label: "12 hours before" },
  { value: 24, label: "24 hours before" },
  { value: 48, label: "48 hours before" },
];

const CUTOFF_OPTIONS = [
  { value: 0, label: "Until start time" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 1440, label: "1 day before" },
];

export function PoliciesPanel({ data }: { data: OnboardingData }) {
  const { entityId, policies, setPolicies, flashSaved } = data;
  const { notify } = useDialogs();

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
        title="Booking policies"
        subtitle="Set your cancellation rules. They're shown to clients before every booking."
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Free cancellation window
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
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Booking closes
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
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        These are studio-wide defaults — you can fine-tune them per service later in Settings.
      </p>
    </div>
  );
}
