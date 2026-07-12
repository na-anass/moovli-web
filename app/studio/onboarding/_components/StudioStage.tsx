"use client";

import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfilePanel } from "./ProfilePanel";
import { PoliciesPanel } from "./PoliciesPanel";
import { ServicesPanel } from "./ServicesPanel";
import { TeamPanel } from "./TeamPanel";
import type { OnboardingData } from "../_lib/useOnboarding";

export type StudioTab = "profile" | "policies" | "services" | "team";

export const STUDIO_TABS: { key: StudioTab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "policies", label: "Policies" },
  { key: "services", label: "Services" },
  { key: "team", label: "Team" },
];

function isTabComplete(tab: StudioTab, data: OnboardingData): boolean {
  switch (tab) {
    case "profile":
      return data.profile.name.trim().length > 0;
    case "services":
      return data.services.length > 0;
    case "team":
      return data.providers.length > 0;
    default:
      return false;
  }
}

export function StudioStage({
  data,
  activeTab,
  onTabChange,
}: {
  data: OnboardingData;
  activeTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
}) {
  const activeIndex = STUDIO_TABS.findIndex((t) => t.key === activeTab);

  return (
    <div>
      {/* Sub-tab chips */}
      <div className="mb-7 flex flex-wrap gap-2">
        {STUDIO_TABS.map((tab, idx) => {
          const done = idx < activeIndex || isTabComplete(tab.key, data);
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[11px]",
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <CheckIcon className="size-3" /> : idx + 1}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "profile" && <ProfilePanel data={data} />}
      {activeTab === "policies" && <PoliciesPanel data={data} />}
      {activeTab === "services" && <ServicesPanel data={data} />}
      {activeTab === "team" && <TeamPanel data={data} />}
    </div>
  );
}
