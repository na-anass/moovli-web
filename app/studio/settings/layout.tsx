"use client";

import { useTranslations } from "next-intl";

import { SettingsNav } from "@/components/studio/settings-nav";
import { SettingsProvider } from "@/lib/studio/settings-context";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("studioSettings");
  return (
    <SettingsProvider>
      <div className="flex flex-col md:flex-row md:gap-8 p-6 md:p-8">
        <aside className="md:w-56 shrink-0 mb-6 md:mb-0">
          <h1 className="text-lg font-semibold px-3 mb-3 hidden md:block">{t("nav.title")}</h1>
          <SettingsNav />
        </aside>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </SettingsProvider>
  );
}
