"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { studioApi, type EntityPolicies } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import { useSettings } from "@/lib/studio/settings-context";
import { SettingsHeader } from "@/components/studio/settings-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/ui/info-tip";
import { FormSection } from "@/components/shared/form-layout";
import { CheckIcon, ClockIcon } from "lucide-react";

export default function PoliciesSettingsPage() {
  const t = useTranslations("studioSettings.policies");
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
    return <p className="text-muted-foreground">{t("noStudioAccess")}</p>;
  }

  return (
    <div className="space-y-6">
      <SettingsHeader
        title={t("title")}
        description={t("description")}
      />

      <FormSection title={t("sectionTitle")} icon={<ClockIcon className="size-5" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-sm font-medium inline-flex items-center gap-1">
              {t("freeCancellationWindow")}
              <InfoTip term="freeCancellationWindow" />
            </label>
            <Input
              type="number"
              min="0"
              className="mt-1.5"
              value={cancelHours}
              disabled={!canEdit}
              onChange={(e) => setCancelHours(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {t("freeCancellationHint")}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">{t("bookingCutoff")}</label>
            <Input
              type="number"
              min="0"
              className="mt-1.5"
              value={cutoffMins}
              disabled={!canEdit}
              onChange={(e) => setCutoffMins(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {t("bookingCutoffHint")}
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 mt-4">
            <Button onClick={save} disabled={busy || !dirty}>
              {busy ? t("savingPolicies") : t("savePolicies")}
            </Button>
            {saved && (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                <CheckIcon className="size-3 mr-1" /> {t("saved")}
              </Badge>
            )}
          </div>
        )}
      </FormSection>
    </div>
  );
}
