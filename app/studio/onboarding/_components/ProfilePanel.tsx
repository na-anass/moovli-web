"use client";

import { useTranslations } from "next-intl";
import { studioApi } from "@/lib/api/studio";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useDialogs } from "@/components/shared/dialogs";
import { LogoUpload } from "./LogoUpload";
import { PanelHeading } from "./PanelHeading";
import { DEFAULT_COLOR, type OnboardingData } from "../_lib/useOnboarding";

const BRAND_PRESETS = [
  { key: "moovliViolet", value: "#7c3aed" },
  { key: "magenta", value: "#d946ef" },
  { key: "teal", value: "#14b8a6" },
  { key: "indigo", value: "#6366f1" },
  { key: "rose", value: "#f43f5e" },
  { key: "emerald", value: "#10b981" },
  { key: "amber", value: "#f59e0b" },
  { key: "slate", value: "#64748b" },
];

export function ProfilePanel({ data }: { data: OnboardingData }) {
  const { entityId, profile, setProfile, color, setColor, flashSaved } = data;
  const { notify } = useDialogs();
  const t = useTranslations("onboarding");

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
        title={t("profile.title")}
        subtitle={t("profile.subtitle")}
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
            <Field label={t("profile.studioName")}>
              <Input
                value={profile.name}
                onChange={(e) => setProfile({ name: e.target.value })}
                onBlur={() => persistProfile({ name: profile.name.trim() })}
                placeholder={t("profile.studioNamePlaceholder")}
              />
            </Field>

            <Field label={t("profile.city")}>
              <Input
                value={profile.city}
                onChange={(e) => setProfile({ city: e.target.value })}
                onBlur={() => persistProfile({ city: profile.city.trim() })}
                placeholder={t("profile.cityPlaceholder")}
              />
            </Field>
          </div>
        </div>

        <Field label={t("profile.description")} optional>
          <Textarea
            rows={2}
            value={profile.short_description}
            onChange={(e) => setProfile({ short_description: e.target.value })}
            onBlur={() =>
              persistProfile({ short_description: profile.short_description.trim() })
            }
            placeholder={t("profile.descriptionPlaceholder")}
          />
        </Field>

        <Field label={t("profile.brandColor")}>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => persistColor(e.target.value)}
              className="size-10 cursor-pointer rounded border"
              aria-label={t("profile.brandColor")}
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
                  {t(`profile.brandPresets.${p.key}`)}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("profile.brandColorHelp")}{" "}
            {color.toLowerCase() !== DEFAULT_COLOR && (
              <button
                type="button"
                className="underline hover:text-foreground"
                onClick={() => persistColor(DEFAULT_COLOR)}
              >
                {t("profile.reset")}
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
  const t = useTranslations("onboarding");
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label}
        {optional && (
          <span className="ml-1 text-xs text-muted-foreground">{t("profile.optional")}</span>
        )}
      </label>
      {children}
    </div>
  );
}
