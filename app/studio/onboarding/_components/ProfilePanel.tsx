"use client";

import { studioApi } from "@/lib/api/studio";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useDialogs } from "@/components/shared/dialogs";
import { LogoUpload } from "./LogoUpload";
import { PanelHeading } from "./PanelHeading";
import { DEFAULT_COLOR, type OnboardingData } from "../_lib/useOnboarding";

const BRAND_PRESETS = [
  { label: "Moovli violet", value: "#7c3aed" },
  { label: "Magenta", value: "#d946ef" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Slate", value: "#64748b" },
];

export function ProfilePanel({ data }: { data: OnboardingData }) {
  const { entityId, profile, setProfile, color, setColor, flashSaved } = data;
  const { notify } = useDialogs();

  const persistProfile = async (patch: Record<string, unknown>) => {
    try {
      await studioApi.updateProfile(entityId, patch);
      flashSaved();
    } catch (e) {
      notify((e as Error).message, { variant: "error" });
    }
  };

  const persistColor = async (next: string) => {
    setColor(next);
    try {
      await studioApi.updateBranding(entityId, next || null);
      flashSaved();
    } catch (e) {
      notify((e as Error).message, { variant: "error" });
    }
  };

  return (
    <div>
      <PanelHeading
        title="Tell us about your studio"
        subtitle="This information appears on your public booking page."
      />

      <div className="space-y-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <LogoUpload
            entityId={entityId}
            value={profile.logo_url}
            onUploaded={(url) => {
              setProfile({ logo_url: url });
              persistProfile({ logo_url: url });
            }}
          />

          <div className="flex-1 space-y-4">
            <Field label="Studio name">
              <Input
                value={profile.name}
                onChange={(e) => setProfile({ name: e.target.value })}
                onBlur={() => persistProfile({ name: profile.name.trim() })}
                placeholder="e.g. FitZone"
              />
            </Field>

            <Field label="City">
              <Input
                value={profile.city}
                onChange={(e) => setProfile({ city: e.target.value })}
                onBlur={() => persistProfile({ city: profile.city.trim() })}
                placeholder="e.g. Casablanca"
              />
            </Field>
          </div>
        </div>

        <Field label="Description" optional>
          <Textarea
            rows={2}
            value={profile.short_description}
            onChange={(e) => setProfile({ short_description: e.target.value })}
            onBlur={() =>
              persistProfile({ short_description: profile.short_description.trim() })
            }
            placeholder="One line to introduce your studio…"
          />
        </Field>

        <Field label="Brand color">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => persistColor(e.target.value)}
              className="size-10 cursor-pointer rounded border"
              aria-label="Brand color"
            />
            <div className="flex flex-wrap gap-2">
              {BRAND_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => persistColor(p.value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-accent",
                    color.toLowerCase() === p.value && "border-primary bg-primary/5",
                  )}
                >
                  <span
                    className="size-3 rounded-full ring-1 ring-border"
                    style={{ backgroundColor: p.value }}
                  />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Used for Book buttons, accents, and price highlights.{" "}
            {color.toLowerCase() !== DEFAULT_COLOR && (
              <button
                type="button"
                className="underline hover:text-foreground"
                onClick={() => persistColor(DEFAULT_COLOR)}
              >
                Reset
              </button>
            )}
          </p>
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label}
        {optional && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
