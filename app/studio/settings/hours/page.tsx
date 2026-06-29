"use client";

import { useState } from "react";
import { useSettings } from "@/lib/studio/settings-context";
import { SettingsHeader } from "@/components/studio/settings-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { FormSection, useEditModeSync } from "@/components/shared/form-layout";
import { CheckIcon, ClockIcon, PencilIcon } from "lucide-react";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

type OperatingHours = Record<string, DayHours>;

export default function HoursSettingsPage() {
  const { entity, loading, canEdit, updateProfile } = useSettings();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hours, setHours] = useState<OperatingHours>({});

  const startEditing = () => {
    setHours(entity?.operating_hours || {});
    setEditing(true);
  };

  const updateDay = (day: string, field: keyof DayHours, value: string | boolean) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      await updateProfile({ operating_hours: hours });
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setHours(entity?.operating_hours || {});
    setEditing(false);
  };

  useEditModeSync({
    editing,
    saving,
    title: "Hours",
    onSave: handleSave,
    onCancel: handleCancel,
  });

  if (loading) {
    return <div className="h-96 rounded-xl border border-border bg-card animate-pulse" />;
  }
  if (!entity) return <p className="text-muted-foreground">Entity not found.</p>;

  const view: OperatingHours = editing ? hours : entity.operating_hours || {};

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Operating Hours"
        description="When your studio is open. Shown to customers on your booking pages."
        action={
          <>
            {success && (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 gap-1">
                <CheckIcon className="size-3" /> Saved
              </Badge>
            )}
            {canEdit && !editing && (
              <Button
                variant="outline"
                size="sm"
                onClick={startEditing}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <PencilIcon className="size-3.5" />
                Edit
              </Button>
            )}
          </>
        }
      />

      <FormSection title="Weekly Schedule" icon={<ClockIcon className="size-5" />}>
        <div className="space-y-2">
          {DAYS.map((day) => {
            const dayHours = view[day] || { open: "09:00", close: "18:00", closed: false };
            return (
              <div
                key={day}
                className="flex items-center gap-4 rounded-lg border border-border px-4 py-3"
              >
                <span className="text-sm font-medium capitalize w-24 shrink-0">{day}</span>

                {editing ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!dayHours.closed}
                        onCheckedChange={(checked) => updateDay(day, "closed", !checked)}
                      />
                      <span className="text-xs text-muted-foreground w-10">
                        {dayHours.closed ? "Closed" : "Open"}
                      </span>
                    </div>
                    {!dayHours.closed ? (
                      <div className="flex items-center gap-2 ml-auto">
                        <Input
                          type="time"
                          className="w-28 h-8 text-sm"
                          value={dayHours.open}
                          onChange={(e) => updateDay(day, "open", e.target.value)}
                        />
                        <span className="text-muted-foreground text-sm">to</span>
                        <Input
                          type="time"
                          className="w-28 h-8 text-sm"
                          value={dayHours.close}
                          onChange={(e) => updateDay(day, "close", e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="ml-auto text-sm text-muted-foreground">Closed</span>
                    )}
                  </>
                ) : (
                  <span className="ml-auto text-sm">
                    {dayHours.closed ? (
                      <span className="text-muted-foreground">Closed</span>
                    ) : (
                      <span className="text-foreground">{dayHours.open} — {dayHours.close}</span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </FormSection>
    </div>
  );
}
