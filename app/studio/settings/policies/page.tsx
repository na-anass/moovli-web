"use client";

import { useEffect, useState } from "react";
import { studioApi, type EntityPolicies } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import { useSettings } from "@/lib/studio/settings-context";
import { SettingsHeader } from "@/components/studio/settings-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSection } from "@/components/shared/form-layout";
import { CheckIcon, ClockIcon } from "lucide-react";

export default function PoliciesSettingsPage() {
  const { entityId } = useActiveEntity();
  const { canEdit } = useSettings();

  const [policies, setPolicies] = useState<EntityPolicies | null>(null);
  const [cancelHours, setCancelHours] = useState("");
  const [cutoffMins, setCutoffMins] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!entityId) return;
    studioApi
      .getPolicies(entityId)
      .then((res) => {
        setPolicies(res.data);
        setCancelHours(String(res.data.cancellation_free_hours));
        setCutoffMins(String(res.data.booking_cutoff_minutes));
      })
      .catch(console.error);
  }, [entityId]);

  const dirty =
    !!policies &&
    (Number(cancelHours) !== policies.cancellation_free_hours ||
      Number(cutoffMins) !== policies.booking_cutoff_minutes);

  const save = async () => {
    if (!entityId) return;
    setBusy(true);
    setSaved(false);
    try {
      const res = await studioApi.updatePolicies(entityId, {
        cancellation_free_hours: Math.max(0, parseInt(cancelHours) || 0),
        booking_cutoff_minutes: Math.max(0, parseInt(cutoffMins) || 0),
      });
      setPolicies(res.data);
      setCancelHours(String(res.data.cancellation_free_hours));
      setCutoffMins(String(res.data.booking_cutoff_minutes));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!entityId) {
    return <p className="text-muted-foreground">No studio access found.</p>;
  }

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Booking Policies"
        description="Studio-wide booking rules the platform enforces on every channel."
      />

      <FormSection title="Booking policies" icon={<ClockIcon className="size-5" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-sm font-medium">Free-cancellation window (hours)</label>
            <Input
              type="number"
              min="0"
              className="mt-1.5"
              value={cancelHours}
              disabled={!canEdit}
              onChange={(e) => setCancelHours(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Customers who cancel at least this many hours before the session get a full refund;
              later cancellations incur the late fee.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Booking cutoff (minutes before start)</label>
            <Input
              type="number"
              min="0"
              className="mt-1.5"
              value={cutoffMins}
              disabled={!canEdit}
              onChange={(e) => setCutoffMins(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              New bookings close this many minutes before a session starts. 0 = open until start.
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 mt-4">
            <Button onClick={save} disabled={busy || !dirty}>
              {busy ? "Saving…" : "Save policies"}
            </Button>
            {saved && (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                <CheckIcon className="size-3 mr-1" /> Saved
              </Badge>
            )}
          </div>
        )}
      </FormSection>
    </div>
  );
}
